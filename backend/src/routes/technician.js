import { Router } from "express";
import { z } from "zod";
import { query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { isProduction, maskPhone } from "../config/env.js";

export const technicianRouter = Router();

function requireTechnician(req, res, next) {
  if (!req.user?.can_technician || !req.user?.technician_id) {
    return res.status(403).json({ message: "当前用户没有技师端权限" });
  }

  next();
}

technicianRouter.use("/technician/me", requireTechnician);

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

technicianRouter.get("/technician/me/summary", asyncHandler(async (req, res) => {
  const practitionerId = req.user.technician_id;
  const [profile, todayAppointments, futureSchedules, commissions] = await Promise.all([
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

  res.json({
    data: {
      profile: profile.rows[0],
      cards: {
        todayAppointments: todayAppointments.rows[0]?.count || 0,
        futureSchedules: futureSchedules.rows[0]?.count || 0,
        grossAmount: commissions.rows[0]?.gross_amount || "0.00",
        commissionAmount: commissions.rows[0]?.commission_amount || "0.00"
      }
    }
  });
}));

technicianRouter.get("/technician/me/schedules", asyncHandler(async (req, res) => {
  const params = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  }).parse(req.query);
  const values = [req.user.technician_id];
  const filters = ["sc.practitioner_id = $1"];
  if (params.date) {
    values.push(params.date);
    filters.push(`sc.work_date = $${values.length}`);
  }

  const { rows } = await query(
    `select sc.id, sc.store_id, sc.practitioner_id, sc.work_date::text as work_date,
            sc.start_time, sc.end_time, sc.capacity, sc.status,
            st.name as store_name,
            count(a.id) filter (where a.status in ('pending','confirmed','completed'))::int as booked_count
       from schedules sc
       left join stores st on st.id = sc.store_id
       left join appointments a on a.schedule_id = sc.id
      where ${filters.join(" and ")}
      group by sc.id, st.name
      order by sc.work_date desc, sc.start_time asc
      limit 120`,
    values
  );
  res.json({ data: rows });
}));

technicianRouter.post("/technician/me/schedules", asyncHandler(async (req, res) => {
  const data = z.object({
    storeId: z.number().int().positive().optional(),
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    capacity: z.coerce.number().int().positive().max(50).default(1),
    status: z.enum(["open", "closed"]).default("open")
  }).parse(req.body);
  if (data.storeId) {
    const { rows: linked } = await query(
      `select 1 from practitioner_stores where practitioner_id = $1 and store_id = $2`,
      [req.user.technician_id, data.storeId]
    );
    if (!linked.length) {
      return res.status(403).json({ message: "您无权为该门店创建排班" });
    }
  }
  const { rows } = await query(
    `insert into schedules (store_id, practitioner_id, work_date, start_time, end_time, capacity, status)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (practitioner_id, work_date, start_time)
     do update set store_id=excluded.store_id, end_time=excluded.end_time, capacity=excluded.capacity, status=excluded.status
     returning id, store_id, practitioner_id, work_date::text as work_date, start_time, end_time, capacity, status`,
    [data.storeId || null, req.user.technician_id, data.workDate, data.startTime, data.endTime, data.capacity, data.status]
  );
  res.status(201).json({ data: rows[0] });
}));

technicianRouter.get("/technician/me/appointments", asyncHandler(async (req, res) => {
  const phoneExpr = isProduction() ? "mask_phone(u.phone)" : "u.phone";
  const { rows } = await query(
    `select a.id, a.order_no, a.status, a.payment_status, a.appointment_date::text as appointment_date,
            a.start_time, a.end_time, a.amount, a.note,
            u.nickname as user_name, ${phoneExpr} as user_phone,
            s.name as service_name, st.name as store_name
       from appointments a
       join users u on u.id = a.user_id
       join services s on s.id = a.service_id
       left join stores st on st.id = a.store_id
      where a.practitioner_id = $1
      order by a.appointment_date desc, a.start_time desc
      limit 100`,
    [req.user.technician_id]
  );
  res.json({ data: rows });
}));

technicianRouter.get("/technician/me/commissions", asyncHandler(async (req, res) => {
  const rows = await commissionRows(req.user.technician_id);
  const summary = rows.reduce((acc, item) => {
    acc.grossAmount += Number(item.gross_amount || 0);
    acc.commissionAmount += Number(item.commission_amount || 0);
    return acc;
  }, { grossAmount: 0, commissionAmount: 0 });

  res.json({
    data: {
      summary: {
        grossAmount: summary.grossAmount.toFixed(2),
        commissionAmount: summary.commissionAmount.toFixed(2)
      },
      rows
    }
  });
}));
