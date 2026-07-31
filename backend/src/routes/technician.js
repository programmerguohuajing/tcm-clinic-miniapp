import { Hono } from "hono";
import { z } from "zod";
import { query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin } from "../middleware/auth.js";

function resolvePractitionerId(c, params) {
  const adminId = params.practitionerId ? Number(params.practitionerId) : null;
  if (adminId) return adminId;
  return c.get("user").technician_id;
}

function adminPractitionerSchema() {
  return z.object({ practitionerId: z.coerce.number().int().positive().optional() });
}

export const technicianRouter = () => {
  const app = new Hono();

  async function commissionRows(practitionerId) {
    const { rows } = await query(
      `select a.id as appointment_id, a.order_no, a.appointment_date::text as appointment_date,
              a.start_time, a.end_time, a.amount::numeric(10,2) as gross_amount,
              coalesce(a.amount * coalesce(cr.rate, 0.18), 0)::numeric(10,2) as commission_amount,
              coalesce(cr.rate, 0.18) as rate,
              s.name as service_name,
              a.status
         from appointments a
         join services s on s.id = a.service_id
         left join lateral (
           select rate
             from commission_rules cr
            where cr.status = 'active'
              and (cr.practitioner_id is null or cr.practitioner_id = a.practitioner_id)
              and (cr.service_id is null or cr.service_id = a.service_id)
              and a.amount >= cr.threshold_amount
            order by cr.practitioner_id nulls last, cr.service_id nulls last, cr.threshold_amount desc
            limit 1
         ) cr on true
        where a.practitioner_id = $1
          and a.status in ('confirmed','completed')
        order by a.appointment_date desc, a.start_time desc
        limit 100`,
      [practitionerId]
    );
    return rows;
  }

  app.get("/technician/me/summary", asyncHandler(async (c) => {
    const params = adminPractitionerSchema().parse(c.req.query());
    const practitionerId = resolvePractitionerId(c, params);
    const [profileResult, todayResult, futureResult, commissionsResult] = await Promise.all([
      query(
        `select p.id, p.name, p.title, p.rating, p.status, st.name as store_name
           from practitioners p
           left join stores st on st.id = p.store_id
          where p.id = $1`,
        [practitionerId]
      ),
      query(
        `select count(*)::int as count
           from appointments
          where practitioner_id = $1
            and appointment_date = current_date
            and status in ('pending','confirmed')`,
        [practitionerId]
      ),
      query(
        `select count(*)::int as count
           from schedules
          where practitioner_id = $1
            and work_date >= current_date
            and status = 'open'`,
        [practitionerId]
      ),
      query(
        `select coalesce(sum(a.amount),0)::numeric(12,2) as gross_amount,
                coalesce(sum(a.amount * coalesce(cr.rate, 0.18)),0)::numeric(12,2) as commission_amount
           from appointments a
           left join lateral (
             select rate
               from commission_rules cr
              where cr.status = 'active'
                and (cr.practitioner_id is null or cr.practitioner_id = a.practitioner_id)
                and (cr.service_id is null or cr.service_id = a.service_id)
                and a.amount >= cr.threshold_amount
              order by cr.practitioner_id nulls last, cr.service_id nulls last, cr.threshold_amount desc
              limit 1
           ) cr on true
          where a.practitioner_id = $1
            and a.status in ('confirmed','completed')`,
        [practitionerId]
      )
    ]);

    return c.json({
      data: {
        profile: profileResult.rows[0],
        cards: {
          todayAppointments: todayResult.rows[0]?.count || 0,
          futureSchedules: futureResult.rows[0]?.count || 0,
          grossAmount: commissionsResult.rows[0]?.gross_amount || "0.00",
          commissionAmount: commissionsResult.rows[0]?.commission_amount || "0.00"
        }
      }
    });
  }));

  app.get("/technician/me/schedules", asyncHandler(async (c) => {
    const params = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      practitionerId: z.coerce.number().int().positive().optional(),
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(100).default(10)
    }).parse(c.req.query());
    const practitionerId = resolvePractitionerId(c, params);
    const values = [practitionerId];
    const filters = ["sc.practitioner_id = $1"];
    if (params.date) {
      values.push(params.date);
      filters.push(`sc.work_date = $${values.length}`);
    }
    const where = filters.join(" and ");
    const offset = (params.page - 1) * params.pageSize;

    const countResult = await query(
      `select count(*)::int as total from schedules sc where ${where}`,
      values
    );
    const { rows } = await query(
      `select sc.id, sc.store_id, sc.practitioner_id, sc.work_date::text as work_date,
              sc.start_time, sc.end_time, sc.capacity, sc.status,
              st.name as store_name,
              count(a.id) filter (where a.status in ('pending','confirmed','completed'))::int as booked_count
         from schedules sc
         left join stores st on st.id = sc.store_id
         left join appointments a on a.schedule_id = sc.id
        where ${where}
        group by sc.id, st.name
        order by sc.work_date desc, sc.start_time asc
        limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, params.pageSize, offset]
    );
    return c.json({
      data: { rows, total: countResult.rows[0].total, totalPages: Math.ceil(countResult.rows[0].total / params.pageSize) }
    });




  }));

  app.post("/technician/me/schedules", asyncHandler(async (c) => {
    const user = c.get("user");
    const data = z.object({
      practitionerId: z.coerce.number().int().positive().optional(),
      storeId: z.coerce.number().int().positive().optional(),
      workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      capacity: z.coerce.number().int().positive().max(50).default(1),
      status: z.enum(["open", "closed"]).default("open")
    }).parse(await c.req.json());

    const practitionerId = data.practitionerId || user.technician_id;
    if (!practitionerId) {
      return c.json({ message: "请先选择技师" }, 400);
    }

    if (data.storeId) {
      const linkedResult = await query(
        `select 1 from practitioner_stores where practitioner_id = $1 and store_id = $2`,
        [practitionerId, data.storeId]
      );
      if (!linkedResult.rows.length) {
        return c.json({ message: "您无权为该门店创建排班" }, 403);
      }
    }

    const { rows } = await query(
      `insert into schedules (store_id, practitioner_id, work_date, start_time, end_time, capacity, status)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (practitioner_id, work_date, start_time)
       do update set store_id=excluded.store_id, end_time=excluded.end_time, capacity=excluded.capacity, status=excluded.status
       returning id, store_id, practitioner_id, work_date::text as work_date, start_time, end_time, capacity, status`,
      [data.storeId || null, practitionerId, data.workDate, data.startTime, data.endTime, data.capacity, data.status]
    );
    return c.json({ data: rows[0] }, 201);
  }));

  app.get("/technician/me/appointments", asyncHandler(async (c) => {
    const params = z.object({
      practitionerId: z.coerce.number().int().positive().optional(),
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(100).default(10)
    }).parse(c.req.query());
    const practitionerId = resolvePractitionerId(c, params);
    const offset = (params.page - 1) * params.pageSize;
    const countResult = await query(
      `select count(*)::int as total from appointments a where a.practitioner_id = $1`,
      [practitionerId]
    );
    const { rows } = await query(
      `select a.id, a.order_no, a.status, a.payment_status, a.appointment_date::text as appointment_date,
              a.start_time, a.end_time, a.amount, a.note,
              u.nickname as user_name, mask_phone(u.phone) as user_phone,
              s.name as service_name, st.name as store_name
         from appointments a
         join users u on u.id = a.user_id
         join services s on s.id = a.service_id
         left join stores st on st.id = a.store_id
        where a.practitioner_id = $1
        order by a.appointment_date desc, a.start_time desc
        limit $2 offset $3`,
      [practitionerId, params.pageSize, offset]
    );
    return c.json({
      data: { rows, total: countResult.rows[0].total }
    });
  }));

  app.get("/technician/me/commissions", asyncHandler(async (c) => {
    const params = z.object({
      practitionerId: z.coerce.number().int().positive().optional(),
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(100).default(10)
    }).parse(c.req.query());
    const practitionerId = resolvePractitionerId(c, params);
    const rows = await commissionRows(practitionerId);
    const offset = (params.page - 1) * params.pageSize;
    const total = rows.length;
    const paged = rows.slice(offset, offset + params.pageSize);
    const summary = rows.reduce((acc, item) => {
      acc.grossAmount += Number(item.gross_amount || 0);
      acc.commissionAmount += Number(item.commission_amount || 0);
      return acc;
    }, { grossAmount: 0, commissionAmount: 0 });

    return c.json({
      data: {
        summary: {
          grossAmount: summary.grossAmount.toFixed(2),
          commissionAmount: summary.commissionAmount.toFixed(2)
        },
        rows: paged,
        total
      }
    });
  }));

  return app;
};
