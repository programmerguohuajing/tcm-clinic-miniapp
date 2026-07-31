import { Hono } from "hono";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { query, tx } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin, requireRole } from "../middleware/auth.js";
import { isProduction, maskPhone } from "../config/env.js";
import { VALID_STATUS_TRANSITIONS } from "../config/constants.js";

export const adminRouter = () => {
  const app = new Hono();

  app.use("/admin/*", requireAdmin);

  const idParam = z.object({ id: z.coerce.number().int().positive() });
  const optionalStoreId = z.object({ storeId: z.coerce.number().int().positive().optional() });

  function emptyToNull(value) {
    return value === undefined || value === "" ? null : value;
  }

  function toArray(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    return String(value).split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  }

  function storeWhere(storeId, alias = "") {
    if (!storeId) return { sql: "", params: [] };
    return { sql: ` and ${alias}store_id = $1`, params: [storeId] };
  }

  function paginate(c) {
    const { page, pageSize } = z.object({
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(100).default(20)
    }).parse(c.req.query());
    const offset = (page - 1) * pageSize;
    return { page, pageSize, offset, limit: pageSize };
  }

  function paginationMeta(page, pageSize, total) {
    return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  async function audit(c, action, targetType, targetId, detail = {}) {
    try {
      await query(
        `insert into admin_audit_logs (user_id, action, target_type, target_id, detail)
         values ($1,$2,$3,$4,$5)`,
        [c.get("user").id, action, targetType, targetId || null, detail]
      );
    } catch (err) {
      console.error("[audit]", err);
    }
  }

  // ── Bootstrap ──
  app.get("/admin/bootstrap", asyncHandler(async (c) => {
    const [stores, services, practitioners] = await Promise.all([
      query(`select id, name, city, address, phone, business_hours, is_default, status from stores order by is_default desc, id`),
      query(`select id, store_id, name, category, price, duration_minutes, is_active from services order by sort_order desc, id desc`),
      query(`select id, store_id, name, title, status, rating from practitioners order by id desc`)
    ]);

    return c.json({ data: { stores: stores.rows, services: services.rows, practitioners: practitioners.rows } });
  }));

  // ── Dashboard ──
  app.get("/admin/dashboard", asyncHandler(async (c) => {
    const schema = optionalStoreId.extend({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    });
    const params = schema.parse(c.req.query());
    const values = [];
    const filters = [];
    if (params.storeId) {
      values.push(params.storeId);
      filters.push(`a.store_id = $${values.length}`);
    }
    if (params.startDate) {
      values.push(params.startDate);
      filters.push(`a.appointment_date >= $${values.length}`);
    }
    if (params.endDate) {
      values.push(params.endDate);
      filters.push(`a.appointment_date <= $${values.length}`);
    }
    const where = filters.length ? `where ${filters.join(" and ")}` : "";
    const activeWhere = where ? `${where} and a.status in ('confirmed','completed')` : `where a.status in ('confirmed','completed')`;

    const [cards, trend, storeRank, serviceRank, practitionerRank, commissions, practitionerCount, userCount] = await Promise.all([
      query(
        `select
           coalesce(sum(a.amount) filter (where a.status in ('confirmed','completed')),0)::numeric(12,2) as revenue,
           count(*)::int as orders,
           count(*) filter (where a.status = 'completed')::int as completed_orders,
           count(distinct a.user_id)::int as served_users,
           coalesce(avg(a.amount) filter (where a.status in ('confirmed','completed')),0)::numeric(12,2) as avg_order
         from appointments a ${where}`,
        values
      ),
      query(
        `select a.appointment_date::text as date,
                coalesce(sum(a.amount) filter (where a.status in ('confirmed','completed')),0)::numeric(12,2) as revenue,
                count(*)::int as orders
           from appointments a ${where}
          group by a.appointment_date
          order by a.appointment_date desc
          limit 14`,
        values
      ),
      query(
        `select coalesce(st.name, '未绑定门店') as store_name,
                coalesce(sum(a.amount) filter (where a.status in ('confirmed','completed')),0)::numeric(12,2) as revenue,
                count(*)::int as orders
           from appointments a
           left join stores st on st.id = a.store_id
          ${where}
          group by st.name
          order by revenue desc
          limit 8`,
        values
      ),
      query(
        `select s.name as service_name,
                count(*)::int as orders,
                coalesce(sum(a.amount) filter (where a.status in ('confirmed','completed')),0)::numeric(12,2) as revenue
           from appointments a
           join services s on s.id = a.service_id
          ${where}
          group by s.name
          order by revenue desc, orders desc
          limit 8`,
        values
      ),
      query(
        `select p.id, p.name as practitioner_name,
                count(*)::int as orders,
                count(*) filter (where a.status = 'completed')::int as completed_orders,
                coalesce(sum(a.amount) filter (where a.status in ('confirmed','completed')),0)::numeric(12,2) as revenue
           from appointments a
           join practitioners p on p.id = a.practitioner_id
          ${where}
          group by p.id, p.name
          order by revenue desc, orders desc
          limit 8`,
        values
      ),
      query(
        `select p.id, p.name as practitioner_name,
                coalesce(sum(a.amount),0)::numeric(12,2) as gross_amount,
                coalesce(sum(a.amount * coalesce(cr.rate, 0.18)),0)::numeric(12,2) as commission_amount
           from appointments a
           join practitioners p on p.id = a.practitioner_id
           left join lateral (
             select rate
               from commission_rules cr
              where cr.status = 'active'
                and (cr.practitioner_id is null or cr.practitioner_id = p.id)
                and (cr.service_id is null or cr.service_id = a.service_id)
                and a.amount >= cr.threshold_amount
              order by cr.practitioner_id nulls last, cr.service_id nulls last, cr.threshold_amount desc
              limit 1
           ) cr on true
          ${activeWhere}
         group by p.id, p.name
         order by commission_amount desc
         limit 8`,
        values
      ),
      query(
        `select count(*)::int as practitioners
           from practitioners p
          where p.status = 'active' ${params.storeId ? "and p.store_id = $1" : ""}`,
        params.storeId ? [params.storeId] : []
      ),
      query(`select count(*)::int as users from users`)
    ]);

    return c.json({
      data: {
        cards: {
          ...cards.rows[0],
          practitioners: practitionerCount.rows[0]?.practitioners || 0,
          users: userCount.rows[0]?.users || 0
        },
        trend: trend.rows.reverse(),
        storeRank: storeRank.rows,
        serviceRank: serviceRank.rows,
        practitionerRank: practitionerRank.rows,
        commissions: commissions.rows
      }
    });
  }));

  // ── Stores CRUD ──
  app.get("/admin/stores", asyncHandler(async (c) => {
    const { keyword, status } = z.object({
      keyword: z.string().optional(),
      status: z.enum(["active", "inactive"]).optional()
    }).parse(c.req.query());
    const values = [];
    const filters = [];
    if (keyword) {
      values.push(`%${keyword}%`);
      filters.push(`(name ilike $${values.length} or city ilike $${values.length} or address ilike $${values.length})`);
    }
    if (status) {
      values.push(status);
      filters.push(`status = $${values.length}`);
    }
    const where = filters.length ? `where ${filters.join(" and ")}` : "";
    const { rows } = await query(
      `select id, name, city, address, phone, business_hours, latitude, longitude, is_default, status, created_at, updated_at
         from stores ${where} order by is_default desc, id desc`,
      values
    );
    return c.json({ data: rows });
  }));

  app.post("/admin/stores", asyncHandler(async (c) => {
    const schema = z.object({
      name: z.string().min(1).max(100),
      city: z.string().max(60).optional(),
      address: z.string().min(1).max(200),
      phone: z.string().max(30).optional(),
      businessHours: z.string().max(120).optional(),
      latitude: z.coerce.number().optional(),
      longitude: z.coerce.number().optional(),
      isDefault: z.boolean().default(false),
      status: z.enum(["active", "inactive"]).default("active")
    });
    const data = schema.parse(await c.req.json());

    const result = await tx([
      data.isDefault ? ["update stores set is_default = false", []] : ["select 1", []],
      [
        `insert into stores (name, city, address, phone, business_hours, latitude, longitude, is_default, status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [data.name, emptyToNull(data.city), data.address, emptyToNull(data.phone), emptyToNull(data.businessHours), data.latitude || null, data.longitude || null, data.isDefault, data.status]
      ]
    ]);

    const storeResult = result[1]; // second query is the INSERT
    const store = storeResult.rows[0];
    await audit(c, "create_store", "store", store.id, data);
    return c.json({ data: store }, 201);
  }));

  app.patch("/admin/stores/:id", asyncHandler(async (c) => {
    const { id } = idParam.parse(c.req.param());
    const data = z.object({
      name: z.string().min(1).max(100),
      city: z.string().max(60).optional(),
      address: z.string().min(1).max(200),
      phone: z.string().max(30).optional(),
      businessHours: z.string().max(120).optional(),
      latitude: z.coerce.number().optional(),
      longitude: z.coerce.number().optional(),
      isDefault: z.boolean().default(false),
      status: z.enum(["active", "inactive"]).default("active")
    }).parse(await c.req.json());

    const result = await tx([
      data.isDefault ? [`update stores set is_default = false where id <> $1`, [id]] : ["select 1", []],
      [
        `update stores set name=$1, city=$2, address=$3, phone=$4, business_hours=$5,
           latitude=$6, longitude=$7, is_default=$8, status=$9, updated_at=now()
         where id=$10 returning *`,
        [data.name, emptyToNull(data.city), data.address, emptyToNull(data.phone), emptyToNull(data.businessHours),
         data.latitude || null, data.longitude || null, data.isDefault, data.status, id]
      ]
    ]);

    const storeResult = result[1];
    await audit(c, "update_store", "store", id, data);
    return c.json({ data: storeResult.rows[0] });
  }));

  // ── Services CRUD ──
  app.get("/admin/services", asyncHandler(async (c) => {
    const { storeId } = optionalStoreId.parse(c.req.query());
    const where = storeWhere(storeId);
    const { rows } = await query(
      `select s.*, st.name as store_name from services s left join stores st on st.id = s.store_id
        where true ${where.sql} order by s.sort_order desc, s.id desc`,
      where.params
    );
    return c.json({ data: rows });
  }));

  app.post("/admin/services", asyncHandler(async (c) => {
    const schema = z.object({
      storeId: z.coerce.number().int().positive().optional(),
      name: z.string().min(1).max(80),
      category: z.string().min(1).max(60),
      description: z.string().max(500).optional(),
      durationMinutes: z.coerce.number().int().positive(),
      price: z.coerce.number().nonnegative(),
      coverUrl: z.string().optional(),
      sortOrder: z.coerce.number().int().default(0),
      isActive: z.boolean().default(true)
    });
    const data = schema.parse(await c.req.json());
    const { rows } = await query(
      `insert into services (store_id, name, category, description, duration_minutes, price, cover_url, sort_order, is_active)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [data.storeId || null, data.name, data.category, emptyToNull(data.description), data.durationMinutes, data.price, emptyToNull(data.coverUrl), data.sortOrder, data.isActive]
    );
    await audit(c, "create_service", "service", rows[0].id, data);
    return c.json({ data: rows[0] }, 201);
  }));

  app.patch("/admin/services/:id", asyncHandler(async (c) => {
    const { id } = idParam.parse(c.req.param());
    const data = z.object({
      storeId: z.coerce.number().int().positive().optional(),
      name: z.string().min(1).max(80),
      category: z.string().min(1).max(60),
      description: z.string().max(500).optional(),
      durationMinutes: z.coerce.number().int().positive(),
      price: z.coerce.number().nonnegative(),
      coverUrl: z.string().optional(),
      sortOrder: z.coerce.number().int().default(0),
      isActive: z.boolean().default(true)
    }).parse(await c.req.json());
    const { rows } = await query(
      `update services set store_id=$1, name=$2, category=$3, description=$4, duration_minutes=$5,
         price=$6, cover_url=$7, sort_order=$8, is_active=$9 where id=$10 returning *`,
      [data.storeId || null, data.name, data.category, emptyToNull(data.description), data.durationMinutes, data.price, emptyToNull(data.coverUrl), data.sortOrder, data.isActive, id]
    );
    await audit(c, "update_service", "service", id, data);
    return c.json({ data: rows[0] });
  }));

  // ── Practitioners CRUD ──
  app.get("/admin/practitioners", asyncHandler(async (c) => {
    const { storeId } = optionalStoreId.parse(c.req.query());
    const where = storeWhere(storeId, "p.");
    const { rows } = await query(
      `select p.*, st.name as store_name,
              coalesce(json_agg(json_build_object('id', s.id, 'name', s.name)) filter (where s.id is not null), '[]') as services
         from practitioners p
         left join stores st on st.id = p.store_id
         left join practitioner_services ps on ps.practitioner_id = p.id
         left join services s on s.id = ps.service_id
        where true ${where.sql}
        group by p.id, st.name
        order by p.id desc`,
      where.params
    );
    return c.json({ data: rows });
  }));

  app.post("/admin/practitioners", asyncHandler(async (c) => {
    const body = await c.req.json();
    const data = z.object({
      storeId: z.coerce.number().int().positive().optional(),
      name: z.string().min(1).max(60),
      title: z.string().max(80).optional().default(""),
      avatarUrl: z.string().optional(),
      bio: z.string().max(800).optional(),
      specialties: z.union([z.array(z.string()), z.string()]).optional(),
      serviceIds: z.array(z.coerce.number().int().positive()).default([]),
      rating: z.coerce.number().min(0).max(5).default(5),
      status: z.enum(["active", "resting", "inactive"]).default("active")
    }).parse({
      ...body,
      storeId: body.storeId === "" || body.storeId === null || body.storeId === undefined ? undefined : body.storeId,
    });

    const result = await tx([
      [
        `insert into practitioners (store_id, name, title, avatar_url, bio, specialties, rating, status)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
        [data.storeId || null, data.name, data.title, emptyToNull(data.avatarUrl), emptyToNull(data.bio), toArray(data.specialties), data.rating, data.status]
      ],
      ...(data.storeId ? [[`insert into practitioner_stores (practitioner_id, store_id, is_primary) values ($1,$2,true) on conflict do nothing`, ["__PLACEHOLDER__", data.storeId]]] : []),
      ...(data.serviceIds.length ? [[`insert into practitioner_services (practitioner_id, service_id) select $1, unnest($2::int[]) on conflict do nothing`, ["__PLACEHOLDER__", data.serviceIds]]] : [])
    ]);

    const practitioner = result[0].rows[0];

    // Manually run the dependent inserts with the actual ID
    if (data.storeId) {
      await query(`insert into practitioner_stores (practitioner_id, store_id, is_primary) values ($1,$2,true) on conflict do nothing`, [practitioner.id, data.storeId]);
    }
    if (data.serviceIds.length) {
      await query(
        `insert into practitioner_services (practitioner_id, service_id) select $1, unnest($2::int[]) on conflict do nothing`,
        [practitioner.id, data.serviceIds]
      );
    }

    await audit(c, "create_practitioner", "practitioner", practitioner.id, data);
    return c.json({ data: practitioner }, 201);
  }));

  app.patch("/admin/practitioners/:id", asyncHandler(async (c) => {
    const { id } = idParam.parse(c.req.param());
    const body = await c.req.json();
    const data = z.object({
      storeId: z.coerce.number().int().positive().optional(),
      name: z.string().min(1).max(60),
      title: z.string().max(80).optional().default(""),
      avatarUrl: z.string().optional(),
      bio: z.string().max(800).optional(),
      specialties: z.union([z.array(z.string()), z.string()]).optional(),
      serviceIds: z.array(z.coerce.number().int().positive()).default([]),
      rating: z.coerce.number().min(0).max(5).default(5),
      status: z.enum(["active", "resting", "inactive"]).default("active")
    }).parse({
      ...body,
      storeId: body.storeId === "" || body.storeId === null || body.storeId === undefined ? undefined : body.storeId,
    });

    const result = await tx([
      [
        `update practitioners set store_id=$1, name=$2, title=$3, avatar_url=$4, bio=$5,
           specialties=$6, rating=$7, status=$8 where id=$9 returning *`,
        [data.storeId || null, data.name, data.title, emptyToNull(data.avatarUrl), emptyToNull(data.bio), toArray(data.specialties), data.rating, data.status, id]
      ],
      [`delete from practitioner_services where practitioner_id=$1`, [id]]
    ]);

    const practitioner = result[0].rows[0];
    if (data.storeId) {
      await query(`insert into practitioner_stores (practitioner_id, store_id, is_primary) values ($1,$2,true) on conflict do nothing`, [id, data.storeId]);
    }
    if (data.serviceIds.length) {
      await query(
        `insert into practitioner_services (practitioner_id, service_id) select $1, unnest($2::int[]) on conflict do nothing`,
        [id, data.serviceIds]
      );
    }

    await audit(c, "update_practitioner", "practitioner", id, data);
    return c.json({ data: practitioner });
  }));

  // ── Schedules ──
  app.get("/admin/schedules", asyncHandler(async (c) => {
    const params = optionalStoreId.extend({
      practitionerId: z.coerce.number().int().positive().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    }).parse(c.req.query());
    const values = [];
    const filters = [];
    if (params.storeId) { values.push(params.storeId); filters.push(`sc.store_id=$${values.length}`); }
    if (params.practitionerId) { values.push(params.practitionerId); filters.push(`sc.practitioner_id=$${values.length}`); }
    if (params.date) { values.push(params.date); filters.push(`sc.work_date=$${values.length}`); }
    const where = filters.length ? `where ${filters.join(" and ")}` : "";
    const { rows } = await query(
      `select sc.id, sc.store_id, sc.practitioner_id, sc.work_date::text as work_date,
              sc.start_time, sc.end_time, sc.capacity, sc.status, sc.created_at,
              p.name as practitioner_name, st.name as store_name
         from schedules sc
         join practitioners p on p.id = sc.practitioner_id
         left join stores st on st.id = sc.store_id
        ${where}
        order by sc.work_date desc, sc.start_time asc
        limit 300`,
      values
    );
    return c.json({ data: rows });
  }));

  app.post("/admin/schedules", asyncHandler(async (c) => {
    const schema = z.object({
      storeId: z.coerce.number().int().positive().optional(),
      practitionerId: z.coerce.number().int().positive(),
      workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      capacity: z.coerce.number().int().positive().max(50).default(1),
      status: z.enum(["open", "closed"]).default("open")
    });
    const data = schema.parse(await c.req.json());
    const { rows } = await query(
      `insert into schedules (store_id, practitioner_id, work_date, start_time, end_time, capacity, status)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (practitioner_id, work_date, start_time)
       do update set store_id=excluded.store_id, end_time=excluded.end_time, capacity=excluded.capacity, status=excluded.status
       returning *`,
      [data.storeId || null, data.practitionerId, data.workDate, data.startTime, data.endTime, data.capacity, data.status]
    );
    await audit(c, "upsert_schedule", "schedule", rows[0].id, data);
    return c.json({ data: rows[0] }, 201);
  }));

  app.post("/admin/schedules/bulk", asyncHandler(async (c) => {
    const schema = z.object({
      storeId: z.coerce.number().int().positive().optional(),
      practitionerId: z.coerce.number().int().positive(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      weekdays: z.array(z.coerce.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
      slots: z.array(z.object({
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        capacity: z.coerce.number().int().positive().max(50).default(1)
      })).min(1)
    });
    const data = schema.parse(await c.req.json());
    const { rows } = await query(
      `with days as (
         select d::date as work_date
           from generate_series($3::date, $4::date, interval '1 day') d
          where extract(dow from d)::int = any($5::int[])
       ), slots as (
         select * from jsonb_to_recordset($6::jsonb) as x(start_time text, end_time text, capacity int)
       ), inserted as (
         insert into schedules (store_id, practitioner_id, work_date, start_time, end_time, capacity, status)
         select $1, $2, days.work_date, slots.start_time::time, slots.end_time::time, slots.capacity, 'open'
           from days cross join slots
         on conflict (practitioner_id, work_date, start_time)
         do update set store_id=excluded.store_id, end_time=excluded.end_time, capacity=excluded.capacity, status='open'
         returning id
       )
       select count(*)::int as count from inserted`,
      [data.storeId || null, data.practitionerId, data.startDate, data.endDate, data.weekdays, JSON.stringify(data.slots.map((slot) => ({ start_time: slot.startTime, end_time: slot.endTime, capacity: slot.capacity })))]
    );
    await audit(c, "bulk_schedule", "schedule", null, data);
    return c.json({ data: rows[0] }, 201);
  }));

  // ── Orders ──
  app.get("/admin/orders", asyncHandler(async (c) => {
    const params = optionalStoreId.extend({
      status: z.string().optional(),
      practitionerId: z.coerce.number().int().positive().optional(),
      keyword: z.string().optional()
    }).parse(c.req.query());
    const { page, pageSize, offset, limit } = paginate(c);
    const values = [];
    const filters = [];
    if (params.storeId) { values.push(params.storeId); filters.push(`a.store_id=$${values.length}`); }
    if (params.status) { values.push(params.status); filters.push(`a.status=$${values.length}`); }
    if (params.practitionerId) { values.push(params.practitionerId); filters.push(`a.practitioner_id=$${values.length}`); }
    if (params.keyword) {
      values.push(`%${params.keyword}%`);
      filters.push(`(u.nickname ilike $${values.length} or a.order_no ilike $${values.length})`);
    }
    const where = filters.length ? `where ${filters.join(" and ")}` : "";
    const countResult = await query(`select count(*)::int as total from appointments a join users u on u.id = a.user_id ${where}`, values);
    const { rows } = await query(
      `select a.id, a.order_no, a.status, a.payment_status, a.appointment_date::text as appointment_date,
              a.start_time, a.end_time, a.amount, a.note,
              u.nickname as user_name, ${isProduction() ? "mask_phone(u.phone) as user_phone" : "u.phone as user_phone"},
              s.name as service_name, p.name as practitioner_name, st.name as store_name
         from appointments a
         join users u on u.id = a.user_id
         join services s on s.id = a.service_id
         join practitioners p on p.id = a.practitioner_id
         left join stores st on st.id = a.store_id
        ${where}
        order by a.created_at desc
        limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, limit, offset]
    );
    return c.json({ data: rows, pagination: paginationMeta(page, pageSize, countResult.rows[0].total) });
  }));

  app.post("/admin/orders", asyncHandler(async (c) => {
    const payload = z.object({
      customerPhone: z.string().min(11).max(11).regex(/^\d+$/),
      customerName: z.string().min(1).max(50).optional(),
      serviceId: z.coerce.number().int().positive(),
      practitionerId: z.coerce.number().int().positive(),
      scheduleId: z.coerce.number().int().positive(),
      storeId: z.coerce.number().int().positive().optional(),
      note: z.string().max(300).optional()
    }).parse(await c.req.json());

    // 1. Find or create user by phone
    const userResult = await query(
      `select id, nickname, phone from users where phone = $1 limit 1`,
      [payload.customerPhone]
    );
    let userId;
    if (userResult.rows[0]) {
      userId = userResult.rows[0].id;
    } else {
      const nickname = payload.customerName || `客户${payload.customerPhone.slice(-4)}`;
      const inserted = await query(
        `insert into users (phone, nickname) values ($1, $2)
         returning id`,
        [payload.customerPhone, nickname]
      );
      userId = inserted.rows[0].id;
    }

    // 2. Get service price
    const svcResult = await query(
      `select price from services where id = $1 and is_active = true`,
      [payload.serviceId]
    );
    if (!svcResult.rows[0]?.price) {
      return c.json({ error: { code: "NOT_FOUND", message: "服务项目不存在或已下架" } }, 404);
    }
    const amount = svcResult.rows[0].price;

    // 3. Create appointment (phone bookings are confirmed directly)
    const { rows } = await query(
      `insert into appointments (
         order_no, user_id, service_id, practitioner_id, schedule_id,
         appointment_date, start_time, end_time, amount, note, store_id, status
       )
       select $1,$2,$3,$4,$5,s.work_date,s.start_time,s.end_time,$6,$7,s.store_id,'confirmed'
         from schedules s
        where s.id = $8 and s.practitioner_id = $9
       returning *`,
      [
        `TCM${randomUUID().slice(0, 8).toUpperCase()}`,
        userId,
        payload.serviceId,
        payload.practitionerId,
        payload.scheduleId,
        amount,
        payload.note || null,
        payload.scheduleId,
        payload.practitionerId
      ]
    );

    const appointment = rows[0];

    // 4. Audit log
    await audit(c, "create_phone_order", "appointment", appointment.id, {
      customerPhone: payload.customerPhone,
      customerName: payload.customerName,
      serviceId: payload.serviceId,
      practitionerId: payload.practitionerId
    });

    return c.json({ data: appointment }, 201);
  }));

  app.patch("/admin/orders/:id/status", asyncHandler(async (c) => {
    const { id } = idParam.parse(c.req.param());
    const { status } = z.object({
      status: z.enum(["pending", "confirmed", "completed", "cancelled", "refunded"])
    }).parse(await c.req.json());

    const currentResult = await query(`select status from appointments where id = $1`, [id]);
    if (!currentResult.rows[0]) return c.json({ error: { code: "NOT_FOUND", message: "订单不存在" } }, 404);

    const allowed = VALID_STATUS_TRANSITIONS[currentResult.rows[0].status];
    if (allowed && !allowed.includes(status)) {
      return c.json({
        error: {
          code: "INVALID_TRANSITION",
          message: `订单状态 ${currentResult.rows[0].status} 不允许变更为 ${status}`,
          allowedTransitions: allowed
        }
      }, 409);
    }

    const { rows } = await query(
      `update appointments
          set status = $1::varchar,
              payment_status = case when $1::varchar = 'completed' then 'paid' else payment_status end,
              updated_at = now()
        where id=$2 returning *`,
      [status, id]
    );

    await audit(c, "update_order_status", "appointment", id, { status });
    return c.json({ data: rows[0] });
  }));

  // ── Commission Rules ──
  app.get("/admin/commission-rules", asyncHandler(async (c) => {
    const { keyword, status } = z.object({
      keyword: z.string().optional(),
      status: z.enum(["active", "inactive"]).optional()
    }).parse(c.req.query());
    const values = [];
    const filters = [];
    if (keyword) {
      values.push(`%${keyword}%`);
      filters.push(`(cr.name ilike $${values.length} or p.name ilike $${values.length} or s.name ilike $${values.length})`);
    }
    if (status) {
      values.push(status);
      filters.push(`cr.status = $${values.length}`);
    }
    const where = filters.length ? `where ${filters.join(" and ")}` : "";
    const { rows } = await query(
      `select cr.*, p.name as practitioner_name, s.name as service_name
         from commission_rules cr
         left join practitioners p on p.id = cr.practitioner_id
         left join services s on s.id = cr.service_id
        ${where}
        order by cr.id desc`,
      values
    );
    return c.json({ data: rows });
  }));

  app.post("/admin/commission-rules", requireRole("owner", "manager"), asyncHandler(async (c) => {
    const schema = z.object({
      name: z.string().min(1).max(80),
      serviceId: z.coerce.number().int().positive().optional(),
      practitionerId: z.coerce.number().int().positive().optional(),
      thresholdAmount: z.coerce.number().nonnegative().default(0),
      rate: z.coerce.number().min(0).max(1),
      status: z.enum(["active", "inactive"]).default("active")
    });
    const data = schema.parse(await c.req.json());
    const { rows } = await query(
      `insert into commission_rules (name, service_id, practitioner_id, threshold_amount, rate, status)
       values ($1,$2,$3,$4,$5,$6) returning *`,
      [data.name, data.serviceId || null, data.practitionerId || null, data.thresholdAmount, data.rate, data.status]
    );
    await audit(c, "create_commission_rule", "commission_rule", rows[0].id, data);
    return c.json({ data: rows[0] }, 201);
  }));

  app.patch("/admin/commission-rules/:id", requireRole("owner", "manager"), asyncHandler(async (c) => {
    const { id } = idParam.parse(c.req.param());
    const schema = z.object({
      name: z.string().min(1).max(80),
      serviceId: z.coerce.number().int().positive().optional(),
      practitionerId: z.coerce.number().int().positive().optional(),
      thresholdAmount: z.coerce.number().nonnegative().default(0),
      rate: z.coerce.number().min(0).max(1),
      status: z.enum(["active", "inactive"]).default("active")
    });
    const data = schema.parse(await c.req.json());
    const { rows } = await query(
      `update commission_rules set name=$1, service_id=$2, practitioner_id=$3, threshold_amount=$4, rate=$5, status=$6
        where id=$7 returning *`,
      [data.name, data.serviceId || null, data.practitionerId || null, data.thresholdAmount, data.rate, data.status, id]
    );
    await audit(c, "update_commission_rule", "commission_rule", id, data);
    return c.json({ data: rows[0] });
  }));

  // ── Homepage Configs ──
  app.get("/admin/homepage-configs", asyncHandler(async (c) => {
    const { storeId } = optionalStoreId.parse(c.req.query());
    const where = storeWhere(storeId, "hc.");
    const { rows } = await query(
      `select hc.*, st.name as store_name from homepage_configs hc
         left join stores st on st.id = hc.store_id
        where true ${where.sql}
        order by hc.sort_order desc, hc.id desc`,
      where.params
    );
    return c.json({ data: rows });
  }));

  app.post("/admin/homepage-configs", asyncHandler(async (c) => {
    const schema = z.object({
      storeId: z.coerce.number().int().positive().optional(),
      sectionKey: z.string().min(1).max(60),
      title: z.string().min(1).max(120),
      payload: z.record(z.any()).default({}),
      sortOrder: z.coerce.number().int().default(0),
      isActive: z.boolean().default(true)
    });
    const data = schema.parse(await c.req.json());
    const { rows } = await query(
      `insert into homepage_configs (store_id, section_key, title, payload, sort_order, is_active)
       values ($1,$2,$3,$4,$5,$6) returning *`,
      [data.storeId || null, data.sectionKey, data.title, data.payload, data.sortOrder, data.isActive]
    );
    await audit(c, "create_homepage_config", "homepage_config", rows[0].id, data);
    return c.json({ data: rows[0] }, 201);
  }));

  app.patch("/admin/homepage-configs/:id", asyncHandler(async (c) => {
    const { id } = idParam.parse(c.req.param());
    const schema = z.object({
      storeId: z.coerce.number().int().positive().optional(),
      sectionKey: z.string().min(1).max(60),
      title: z.string().min(1).max(120),
      payload: z.record(z.any()).default({}),
      sortOrder: z.coerce.number().int().default(0),
      isActive: z.boolean().default(true)
    });
    const data = schema.parse(await c.req.json());
    const { rows } = await query(
      `update homepage_configs set store_id=$1, section_key=$2, title=$3, payload=$4, sort_order=$5, is_active=$6, updated_at=now()
        where id=$7 returning *`,
      [data.storeId || null, data.sectionKey, data.title, data.payload, data.sortOrder, data.isActive, id]
    );
    await audit(c, "update_homepage_config", "homepage_config", id, data);
    return c.json({ data: rows[0] });
  }));

  // ── Activities CRUD ──
  app.get("/admin/activities", asyncHandler(async (c) => {
    const { storeId } = optionalStoreId.parse(c.req.query());
    const where = storeWhere(storeId, "a.");
    const { rows } = await query(
      `select a.*, st.name as store_name from activities a left join stores st on st.id=a.store_id where true ${where.sql} order by a.sort_order desc, a.id desc`,
      where.params
    );
    return c.json({ data: rows });
  }));

  app.post("/admin/activities", asyncHandler(async (c) => {
    const schema = z.object({
      storeId: z.coerce.number().int().positive().optional(),
      title: z.string().min(1).max(120),
      subtitle: z.string().max(200).optional(),
      coverUrl: z.string().optional(),
      price: z.coerce.number().optional(),
      originalPrice: z.coerce.number().optional(),
      tag: z.string().max(40).optional(),
      isActive: z.boolean().default(true),
      sortOrder: z.coerce.number().int().default(0)
    });
    const data = schema.parse(await c.req.json());
    const { rows } = await query(
      `insert into activities (store_id, title, subtitle, cover_url, price, original_price, tag, is_active, sort_order, starts_at, ends_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now()+interval '30 days') returning *`,
      [data.storeId || null, data.title, emptyToNull(data.subtitle), emptyToNull(data.coverUrl), data.price || null, data.originalPrice || null, emptyToNull(data.tag), data.isActive, data.sortOrder]
    );
    await audit(c, "create_activity", "activity", rows[0].id, data);
    return c.json({ data: rows[0] }, 201);
  }));

  // ── Articles CRUD ──
  app.get("/admin/articles", asyncHandler(async (c) => {
    const { storeId } = optionalStoreId.parse(c.req.query());
    const where = storeWhere(storeId, "a.");
    const { rows } = await query(
      `select a.*, st.name as store_name from articles a left join stores st on st.id=a.store_id where true ${where.sql} order by a.published_at desc nulls last, a.id desc`,
      where.params
    );
    return c.json({ data: rows });
  }));

  app.post("/admin/articles", asyncHandler(async (c) => {
    const schema = z.object({
      storeId: z.coerce.number().int().positive().optional(),
      title: z.string().min(1).max(160),
      summary: z.string().max(260).optional(),
      content: z.string().optional(),
      coverUrl: z.string().optional(),
      category: z.string().max(60).optional(),
      readMinutes: z.coerce.number().int().positive().default(3),
      status: z.enum(["draft", "published"]).default("draft")
    });
    const data = schema.parse(await c.req.json());
    const { rows } = await query(
      `insert into articles (store_id, title, summary, content, cover_url, category, read_minutes, status, published_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,case when $8='published' then now() else null end) returning *`,
      [data.storeId || null, data.title, emptyToNull(data.summary), emptyToNull(data.content), emptyToNull(data.coverUrl), emptyToNull(data.category), data.readMinutes, data.status]
    );
    await audit(c, "create_article", "article", rows[0].id, data);
    return c.json({ data: rows[0] }, 201);
  }));

  // ── Users ──
  app.get("/admin/users", asyncHandler(async (c) => {
    const params = z.object({
      keyword: z.string().optional(),
      adminRole: z.enum(["member", "frontdesk", "manager", "owner"]).optional(),
      canManage: z.coerce.boolean().optional()
    }).parse(c.req.query());
    const { page, pageSize, offset, limit } = paginate(c);
    const values = [];
    const filters = [];
    if (params.keyword) {
      values.push(`%${params.keyword}%`);
      filters.push(`(u.nickname ilike $${values.length} or u.phone ilike $${values.length})`);
    }
    if (params.adminRole) {
      values.push(params.adminRole);
      filters.push(`u.admin_role = $${values.length}`);
    }
    if (params.canManage !== undefined) {
      values.push(params.canManage);
      filters.push(`u.can_manage = $${values.length}`);
    }
    const where = filters.length ? `where ${filters.join(" and ")}` : "";
    const countResult = await query(`select count(*)::int as total from users u ${where}`, values);
    const { rows } = await query(
      `select u.id, u.nickname, ${isProduction() ? "mask_phone(u.phone) as phone" : "u.phone"}, u.member_level, u.points, u.admin_role, u.can_manage, u.created_at,
              count(a.id)::int as appointment_count,
              coalesce(sum(a.amount) filter (where a.status in ('confirmed','completed')),0)::numeric(12,2) as total_spend
         from users u
         left join appointments a on a.user_id = u.id
        ${where}
        group by u.id
        order by u.id desc
        limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, limit, offset]
    );
    return c.json({ data: rows, pagination: paginationMeta(page, pageSize, countResult.rows[0].total) });
  }));

  app.patch("/admin/users/:id/role", requireRole("owner"), asyncHandler(async (c) => {
    const { id } = idParam.parse(c.req.param());
    const schema = z.object({
      adminRole: z.enum(["member", "frontdesk", "manager", "owner"]),
      canManage: z.boolean()
    });
    const data = schema.parse(await c.req.json());
    const { rows } = await query(
      `update users set admin_role=$1, can_manage=$2, updated_at=now() where id=$3
       returning id, nickname, admin_role, can_manage`,
      [data.adminRole, data.canManage, id]
    );
    await audit(c, "update_user_role", "user", id, data);
    return c.json({ data: rows[0] });
  }));

  // ── Reviews ──
  app.get("/admin/reviews", asyncHandler(async (c) => {
    const params = z.object({
      keyword: z.string().optional(),
      status: z.enum(["visible", "hidden"]).optional(),
      rating: z.coerce.number().int().min(1).max(5).optional()
    }).parse(c.req.query());
    const { page, pageSize, offset, limit } = paginate(c);
    const values = [];
    const filters = [];
    if (params.keyword) {
      values.push(`%${params.keyword}%`);
      filters.push(`(r.content ilike $${values.length} or u.nickname ilike $${values.length} or p.name ilike $${values.length})`);
    }
    if (params.status) {
      values.push(params.status);
      filters.push(`r.status = $${values.length}`);
    }
    if (params.rating) {
      values.push(params.rating);
      filters.push(`r.rating = $${values.length}`);
    }
    const where = filters.length ? `where ${filters.join(" and ")}` : "";
    const countResult = await query(`select count(*)::int as total from reviews r left join users u on u.id = r.user_id left join practitioners p on p.id = r.practitioner_id ${where}`, values);
    const { rows } = await query(
      `select r.*, u.nickname as user_name, p.name as practitioner_name, st.name as store_name
         from reviews r
         left join users u on u.id = r.user_id
         left join practitioners p on p.id = r.practitioner_id
         left join stores st on st.id = r.store_id
        ${where}
        order by r.created_at desc
        limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, limit, offset]
    );
    return c.json({ data: rows, pagination: paginationMeta(page, pageSize, countResult.rows[0].total) });
  }));

  app.patch("/admin/reviews/:id", asyncHandler(async (c) => {
    const { id } = idParam.parse(c.req.param());
    const schema = z.object({
      reply: z.string().max(500).optional(),
      status: z.enum(["visible", "hidden"]).default("visible")
    });
    const data = schema.parse(await c.req.json());
    const { rows } = await query(
      `update reviews set reply=$1, status=$2 where id=$3 returning *`,
      [emptyToNull(data.reply), data.status, id]
    );
    if (!rows[0]) return c.json({ error: { code: "NOT_FOUND", message: "评价不存在" } }, 404);
    await audit(c, "update_review", "review", id, data);
    return c.json({ data: rows[0] });
  }));

  // ── Audit Logs ──
  app.get("/admin/audit-logs", asyncHandler(async (c) => {
    const params = z.object({
      keyword: z.string().optional(),
      action: z.string().optional(),
      targetType: z.string().optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    }).parse(c.req.query());
    const { page, pageSize, offset, limit } = paginate(c);
    const values = [];
    const filters = [];
    if (params.keyword) {
      values.push(`%${params.keyword}%`);
      filters.push(`(l.action ilike $${values.length} or l.target_type ilike $${values.length} or u.nickname ilike $${values.length})`);
    }
    if (params.action) {
      values.push(params.action);
      filters.push(`l.action = $${values.length}`);
    }
    if (params.targetType) {
      values.push(params.targetType);
      filters.push(`l.target_type = $${values.length}`);
    }
    if (params.startDate) {
      values.push(params.startDate);
      filters.push(`l.created_at >= $${values.length}::date`);
    }
    if (params.endDate) {
      values.push(params.endDate);
      filters.push(`l.created_at < ($${values.length}::date + interval '1 day')`);
    }
    const where = filters.length ? `where ${filters.join(" and ")}` : "";
    const countResult = await query(`select count(*)::int as total from admin_audit_logs l left join users u on u.id = l.user_id ${where}`, values);
    const { rows } = await query(
      `select l.*, u.nickname as user_name
         from admin_audit_logs l
         left join users u on u.id = l.user_id
        ${where}
        order by l.created_at desc
        limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, limit, offset]
    );
    return c.json({ data: rows, pagination: paginationMeta(page, pageSize, countResult.rows[0].total) });
  }));

  // ── Payment Configs ──
  const paymentConfigSchema = z.object({
    configKey: z.enum(["wechat_pay", "mock_payment"]),
    storeId: z.coerce.number().int().positive().optional()
  });

  app.get("/admin/payment-configs", asyncHandler(async (c) => {
    const { storeId } = paymentConfigSchema.pick({ storeId: true }).parse(c.req.query());
    const values = [];
    const filters = ["true"];
    if (storeId) {
      values.push(storeId);
      filters.push(`pc.store_id = $${values.length}`);
    } else {
      filters.push(`pc.store_id is null`);
    }
    const { rows } = await query(
      `select pc.*, st.name as store_name
         from payment_configs pc
         left join stores st on st.id = pc.store_id
        where ${filters.join(" and ")}
        order by pc.config_key`,
      values
    );
    return c.json({ data: rows });
  }));

  app.post("/admin/payment-configs", requireRole("owner", "manager"), asyncHandler(async (c) => {
    const schema = z.object({
      configKey: z.enum(["wechat_pay", "mock_payment"]),
      storeId: z.coerce.number().int().positive().optional()
    });
    const data = schema.parse(await c.req.json());
    const { rows } = await query(
      `insert into payment_configs (store_id, config_key, config_value, is_active)
       values ($1,$2,$3::jsonb,true)
       on conflict (store_id, config_key) do update set config_value = payment_configs.config_value
       returning *`,
      [data.storeId || null, data.configKey, "{}"]
    );
    await audit(c, "create_payment_config", "payment_config", rows[0].id, data);
    return c.json({ data: rows[0] });
  }));

  app.patch("/admin/payment-configs/:id", requireRole("owner", "manager"), asyncHandler(async (c) => {
    const { id } = idParam.parse(c.req.param());
    const schema = z.object({
      configKey: z.enum(["wechat_pay", "mock_payment"]).optional(),
      configValue: z.string().optional(),
      isActive: z.boolean().optional()
    });
    const data = schema.parse(await c.req.json());
    const sets = [];
    const values = [id];
    if (data.configKey) { sets.push(`config_key = $${values.length + 1}`); values.push(data.configKey); }
    if (data.configValue !== undefined) {
      try { JSON.parse(data.configValue); } catch {
        return c.json({ error: { code: "BAD_REQUEST", message: "config_value 必须是合法 JSON" } }, 400);
      }
      sets.push(`config_value = $${values.length + 1}::jsonb`); values.push(data.configValue);
    }
    if (data.isActive !== undefined) { sets.push(`is_active = $${values.length + 1}`); values.push(data.isActive); }
    if (!sets.length) return c.json({ error: { code: "BAD_REQUEST", message: "无有效更新字段" } }, 400);
    const { rows } = await query(`update payment_configs set ${sets.join(", ")} where id = $1 returning *`, values);
    if (!rows[0]) return c.json({ error: { code: "NOT_FOUND", message: "支付配置不存在" } }, 404);
    await audit(c, "update_payment_config", "payment_config", id, data);
    return c.json({ data: rows[0] });
  }));

  return app;
};
