import { Router } from "express";
import { z } from "zod";
import { query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin } from "../middleware/auth.js";

export const adminRouter = Router();

adminRouter.use("/admin", requireAdmin);

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

async function audit(req, action, targetType, targetId, detail = {}) {
  await query(
    `insert into admin_audit_logs (user_id, action, target_type, target_id, detail)
     values ($1,$2,$3,$4,$5)`,
    [req.user.id, action, targetType, targetId || null, detail]
  );
}

adminRouter.get("/admin/bootstrap", asyncHandler(async (_req, res) => {
  const [stores, services, practitioners] = await Promise.all([
    query(`select id, name, city, address, phone, business_hours, is_default, status from stores order by is_default desc, id`),
    query(`select id, store_id, name, category, price, duration_minutes, is_active from services order by sort_order desc, id desc`),
    query(`select id, store_id, name, title, status, rating from practitioners order by id desc`)
  ]);

  res.json({ data: { stores: stores.rows, services: services.rows, practitioners: practitioners.rows } });
}));

adminRouter.get("/admin/dashboard", asyncHandler(async (req, res) => {
  const schema = optionalStoreId.extend({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  });
  const params = schema.parse(req.query);
  const filters = [];
  const values = [];
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
    query(
      `select count(*)::int as users
         from users`
    )
  ]);

  res.json({
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

adminRouter.get("/admin/stores", asyncHandler(async (req, res) => {
  const params = z.object({
    keyword: z.string().optional(),
    status: z.enum(["active", "inactive"]).optional()
  }).parse(req.query);
  const values = [];
  const filters = [];
  if (params.keyword) {
    values.push(`%${params.keyword}%`);
    filters.push(`(name ilike $${values.length} or city ilike $${values.length} or address ilike $${values.length})`);
  }
  if (params.status) {
    values.push(params.status);
    filters.push(`status = $${values.length}`);
  }
  const where = filters.length ? `where ${filters.join(" and ")}` : "";
  const { rows } = await query(`select * from stores ${where} order by is_default desc, id desc`, values);
  res.json({ data: rows });
}));

adminRouter.post("/admin/stores", asyncHandler(async (req, res) => {
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
  const data = schema.parse(req.body);
  if (data.isDefault) await query(`update stores set is_default = false`);
  const { rows } = await query(
    `insert into stores (name, city, address, phone, business_hours, latitude, longitude, is_default, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [data.name, emptyToNull(data.city), data.address, emptyToNull(data.phone), emptyToNull(data.businessHours), data.latitude || null, data.longitude || null, data.isDefault, data.status]
  );
  await audit(req, "create_store", "store", rows[0].id, data);
  res.status(201).json({ data: rows[0] });
}));

adminRouter.patch("/admin/stores/:id", asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
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
  }).parse(req.body);
  if (data.isDefault) await query(`update stores set is_default = false where id <> $1`, [id]);
  const { rows } = await query(
    `update stores set name=$1, city=$2, address=$3, phone=$4, business_hours=$5,
       latitude=$6, longitude=$7, is_default=$8, status=$9, updated_at=now()
     where id=$10 returning *`,
    [data.name, emptyToNull(data.city), data.address, emptyToNull(data.phone), emptyToNull(data.businessHours), data.latitude || null, data.longitude || null, data.isDefault, data.status, id]
  );
  await audit(req, "update_store", "store", id, data);
  res.json({ data: rows[0] });
}));

adminRouter.get("/admin/services", asyncHandler(async (req, res) => {
  const { storeId } = optionalStoreId.parse(req.query);
  const where = storeWhere(storeId);
  const { rows } = await query(
    `select s.*, st.name as store_name from services s left join stores st on st.id = s.store_id
      where true ${where.sql} order by s.sort_order desc, s.id desc`,
    where.params
  );
  res.json({ data: rows });
}));

adminRouter.post("/admin/services", asyncHandler(async (req, res) => {
  const data = z.object({
    storeId: z.number().int().positive().optional(),
    name: z.string().min(1).max(80),
    category: z.string().min(1).max(60),
    description: z.string().max(500).optional(),
    durationMinutes: z.coerce.number().int().positive(),
    price: z.coerce.number().nonnegative(),
    coverUrl: z.string().optional(),
    sortOrder: z.coerce.number().int().default(0),
    isActive: z.boolean().default(true)
  }).parse(req.body);
  const { rows } = await query(
    `insert into services (store_id, name, category, description, duration_minutes, price, cover_url, sort_order, is_active)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [data.storeId || null, data.name, data.category, emptyToNull(data.description), data.durationMinutes, data.price, emptyToNull(data.coverUrl), data.sortOrder, data.isActive]
  );
  await audit(req, "create_service", "service", rows[0].id, data);
  res.status(201).json({ data: rows[0] });
}));

adminRouter.patch("/admin/services/:id", asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = z.object({
    storeId: z.number().int().positive().optional(),
    name: z.string().min(1).max(80),
    category: z.string().min(1).max(60),
    description: z.string().max(500).optional(),
    durationMinutes: z.coerce.number().int().positive(),
    price: z.coerce.number().nonnegative(),
    coverUrl: z.string().optional(),
    sortOrder: z.coerce.number().int().default(0),
    isActive: z.boolean().default(true)
  }).parse(req.body);
  const { rows } = await query(
    `update services set store_id=$1, name=$2, category=$3, description=$4, duration_minutes=$5,
       price=$6, cover_url=$7, sort_order=$8, is_active=$9 where id=$10 returning *`,
    [data.storeId || null, data.name, data.category, emptyToNull(data.description), data.durationMinutes, data.price, emptyToNull(data.coverUrl), data.sortOrder, data.isActive, id]
  );
  await audit(req, "update_service", "service", id, data);
  res.json({ data: rows[0] });
}));

adminRouter.get("/admin/practitioners", asyncHandler(async (req, res) => {
  const { storeId } = optionalStoreId.parse(req.query);
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
  res.json({ data: rows });
}));

adminRouter.post("/admin/practitioners", asyncHandler(async (req, res) => {
  const data = z.object({
    storeId: z.number().int().positive().optional(),
    name: z.string().min(1).max(60),
    title: z.string().min(1).max(80),
    avatarUrl: z.string().optional(),
    bio: z.string().max(800).optional(),
    specialties: z.union([z.array(z.string()), z.string()]).optional(),
    serviceIds: z.array(z.number().int().positive()).default([]),
    rating: z.coerce.number().min(0).max(5).default(5),
    status: z.enum(["active", "resting", "inactive"]).default("active")
  }).parse(req.body);
  const { rows } = await query(
    `insert into practitioners (store_id, name, title, avatar_url, bio, specialties, rating, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [data.storeId || null, data.name, data.title, emptyToNull(data.avatarUrl), emptyToNull(data.bio), toArray(data.specialties), data.rating, data.status]
  );
  const practitioner = rows[0];
  if (data.storeId) {
    await query(`insert into practitioner_stores (practitioner_id, store_id, is_primary) values ($1,$2,true) on conflict do nothing`, [practitioner.id, data.storeId]);
  }
  for (const serviceId of data.serviceIds) {
    await query(`insert into practitioner_services (practitioner_id, service_id) values ($1,$2) on conflict do nothing`, [practitioner.id, serviceId]);
  }
  await audit(req, "create_practitioner", "practitioner", practitioner.id, data);
  res.status(201).json({ data: practitioner });
}));

adminRouter.patch("/admin/practitioners/:id", asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = z.object({
    storeId: z.number().int().positive().optional(),
    name: z.string().min(1).max(60),
    title: z.string().min(1).max(80),
    avatarUrl: z.string().optional(),
    bio: z.string().max(800).optional(),
    specialties: z.union([z.array(z.string()), z.string()]).optional(),
    serviceIds: z.array(z.number().int().positive()).default([]),
    rating: z.coerce.number().min(0).max(5).default(5),
    status: z.enum(["active", "resting", "inactive"]).default("active")
  }).parse(req.body);
  const { rows } = await query(
    `update practitioners set store_id=$1, name=$2, title=$3, avatar_url=$4, bio=$5,
       specialties=$6, rating=$7, status=$8 where id=$9 returning *`,
    [data.storeId || null, data.name, data.title, emptyToNull(data.avatarUrl), emptyToNull(data.bio), toArray(data.specialties), data.rating, data.status, id]
  );
  await query(`delete from practitioner_services where practitioner_id=$1`, [id]);
  for (const serviceId of data.serviceIds) {
    await query(`insert into practitioner_services (practitioner_id, service_id) values ($1,$2) on conflict do nothing`, [id, serviceId]);
  }
  if (data.storeId) {
    await query(`insert into practitioner_stores (practitioner_id, store_id, is_primary) values ($1,$2,true) on conflict do nothing`, [id, data.storeId]);
  }
  await audit(req, "update_practitioner", "practitioner", id, data);
  res.json({ data: rows[0] });
}));

adminRouter.get("/admin/schedules", asyncHandler(async (req, res) => {
  const params = optionalStoreId.extend({
    practitionerId: z.coerce.number().int().positive().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  }).parse(req.query);
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
  res.json({ data: rows });
}));

adminRouter.post("/admin/schedules", asyncHandler(async (req, res) => {
  const data = z.object({
    storeId: z.number().int().positive().optional(),
    practitionerId: z.number().int().positive(),
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    capacity: z.coerce.number().int().positive().max(50).default(1),
    status: z.enum(["open", "closed"]).default("open")
  }).parse(req.body);
  const { rows } = await query(
    `insert into schedules (store_id, practitioner_id, work_date, start_time, end_time, capacity, status)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (practitioner_id, work_date, start_time)
     do update set store_id=excluded.store_id, end_time=excluded.end_time, capacity=excluded.capacity, status=excluded.status
     returning *`,
    [data.storeId || null, data.practitionerId, data.workDate, data.startTime, data.endTime, data.capacity, data.status]
  );
  await audit(req, "upsert_schedule", "schedule", rows[0].id, data);
  res.status(201).json({ data: rows[0] });
}));

adminRouter.post("/admin/schedules/bulk", asyncHandler(async (req, res) => {
  const data = z.object({
    storeId: z.number().int().positive().optional(),
    practitionerId: z.number().int().positive(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    weekdays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
    slots: z.array(z.object({
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      capacity: z.coerce.number().int().positive().max(50).default(1)
    })).min(1)
  }).parse(req.body);
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
  await audit(req, "bulk_schedule", "schedule", null, data);
  res.status(201).json({ data: rows[0] });
}));

adminRouter.get("/admin/orders", asyncHandler(async (req, res) => {
  const params = optionalStoreId.extend({
    status: z.string().optional(),
    practitionerId: z.coerce.number().int().positive().optional(),
    keyword: z.string().optional()
  }).parse(req.query);
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
  const { rows } = await query(
    `select a.id, a.order_no, a.status, a.payment_status, a.appointment_date::text as appointment_date,
            a.start_time, a.end_time, a.amount, a.note,
            u.nickname as user_name, u.phone as user_phone,
            s.name as service_name, p.name as practitioner_name, st.name as store_name
       from appointments a
       join users u on u.id = a.user_id
       join services s on s.id = a.service_id
       join practitioners p on p.id = a.practitioner_id
       left join stores st on st.id = a.store_id
      ${where}
      order by a.created_at desc
      limit 200`,
    values
  );
  res.json({ data: rows });
}));

adminRouter.patch("/admin/orders/:id/status", asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { status } = z.object({
    status: z.enum(["pending", "confirmed", "completed", "cancelled", "refunded"])
  }).parse(req.body);
  const { rows } = await query(
    `update appointments
        set status = $1::varchar,
            payment_status = case when $1::varchar = 'completed' then 'paid' else payment_status end,
            updated_at = now()
      where id=$2 returning *`,
    [status, id]
  );
  if (!rows[0]) return res.status(404).json({ message: "订单不存在" });
  await audit(req, "update_order_status", "appointment", id, { status });
  res.json({ data: rows[0] });
}));

adminRouter.get("/admin/commission-rules", asyncHandler(async (req, res) => {
  const params = z.object({
    keyword: z.string().optional(),
    status: z.enum(["active", "inactive"]).optional()
  }).parse(req.query);
  const values = [];
  const filters = [];
  if (params.keyword) {
    values.push(`%${params.keyword}%`);
    filters.push(`(cr.name ilike $${values.length} or p.name ilike $${values.length} or s.name ilike $${values.length})`);
  }
  if (params.status) {
    values.push(params.status);
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
  res.json({ data: rows });
}));

adminRouter.post("/admin/commission-rules", asyncHandler(async (req, res) => {
  const data = z.object({
    name: z.string().min(1).max(80),
    serviceId: z.number().int().positive().optional(),
    practitionerId: z.number().int().positive().optional(),
    thresholdAmount: z.coerce.number().nonnegative().default(0),
    rate: z.coerce.number().min(0).max(1),
    status: z.enum(["active", "inactive"]).default("active")
  }).parse(req.body);
  const { rows } = await query(
    `insert into commission_rules (name, service_id, practitioner_id, threshold_amount, rate, status)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [data.name, data.serviceId || null, data.practitionerId || null, data.thresholdAmount, data.rate, data.status]
  );
  await audit(req, "create_commission_rule", "commission_rule", rows[0].id, data);
  res.status(201).json({ data: rows[0] });
}));

adminRouter.patch("/admin/commission-rules/:id", asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = z.object({
    name: z.string().min(1).max(80),
    serviceId: z.number().int().positive().optional(),
    practitionerId: z.number().int().positive().optional(),
    thresholdAmount: z.coerce.number().nonnegative().default(0),
    rate: z.coerce.number().min(0).max(1),
    status: z.enum(["active", "inactive"]).default("active")
  }).parse(req.body);
  const { rows } = await query(
    `update commission_rules set name=$1, service_id=$2, practitioner_id=$3, threshold_amount=$4, rate=$5, status=$6
      where id=$7 returning *`,
    [data.name, data.serviceId || null, data.practitionerId || null, data.thresholdAmount, data.rate, data.status, id]
  );
  await audit(req, "update_commission_rule", "commission_rule", id, data);
  res.json({ data: rows[0] });
}));

adminRouter.get("/admin/homepage-configs", asyncHandler(async (req, res) => {
  const { storeId } = optionalStoreId.parse(req.query);
  const where = storeWhere(storeId, "hc.");
  const { rows } = await query(
    `select hc.*, st.name as store_name from homepage_configs hc
       left join stores st on st.id = hc.store_id
      where true ${where.sql}
      order by hc.sort_order desc, hc.id desc`,
    where.params
  );
  res.json({ data: rows });
}));

adminRouter.post("/admin/homepage-configs", asyncHandler(async (req, res) => {
  const data = z.object({
    storeId: z.number().int().positive().optional(),
    sectionKey: z.string().min(1).max(60),
    title: z.string().min(1).max(120),
    payload: z.record(z.any()).default({}),
    sortOrder: z.coerce.number().int().default(0),
    isActive: z.boolean().default(true)
  }).parse(req.body);
  const { rows } = await query(
    `insert into homepage_configs (store_id, section_key, title, payload, sort_order, is_active)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [data.storeId || null, data.sectionKey, data.title, data.payload, data.sortOrder, data.isActive]
  );
  await audit(req, "create_homepage_config", "homepage_config", rows[0].id, data);
  res.status(201).json({ data: rows[0] });
}));

adminRouter.patch("/admin/homepage-configs/:id", asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = z.object({
    storeId: z.number().int().positive().optional(),
    sectionKey: z.string().min(1).max(60),
    title: z.string().min(1).max(120),
    payload: z.record(z.any()).default({}),
    sortOrder: z.coerce.number().int().default(0),
    isActive: z.boolean().default(true)
  }).parse(req.body);
  const { rows } = await query(
    `update homepage_configs set store_id=$1, section_key=$2, title=$3, payload=$4, sort_order=$5, is_active=$6, updated_at=now()
      where id=$7 returning *`,
    [data.storeId || null, data.sectionKey, data.title, data.payload, data.sortOrder, data.isActive, id]
  );
  await audit(req, "update_homepage_config", "homepage_config", id, data);
  res.json({ data: rows[0] });
}));

adminRouter.get("/admin/activities", asyncHandler(async (req, res) => {
  const { storeId } = optionalStoreId.parse(req.query);
  const where = storeWhere(storeId, "a.");
  const { rows } = await query(`select a.*, st.name as store_name from activities a left join stores st on st.id=a.store_id where true ${where.sql} order by a.sort_order desc, a.id desc`, where.params);
  res.json({ data: rows });
}));

adminRouter.post("/admin/activities", asyncHandler(async (req, res) => {
  const data = z.object({
    storeId: z.number().int().positive().optional(),
    title: z.string().min(1).max(120),
    subtitle: z.string().max(200).optional(),
    coverUrl: z.string().optional(),
    price: z.coerce.number().optional(),
    originalPrice: z.coerce.number().optional(),
    tag: z.string().max(40).optional(),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().default(0)
  }).parse(req.body);
  const { rows } = await query(
    `insert into activities (store_id, title, subtitle, cover_url, price, original_price, tag, is_active, sort_order, starts_at, ends_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now()+interval '30 days') returning *`,
    [data.storeId || null, data.title, emptyToNull(data.subtitle), emptyToNull(data.coverUrl), data.price || null, data.originalPrice || null, emptyToNull(data.tag), data.isActive, data.sortOrder]
  );
  await audit(req, "create_activity", "activity", rows[0].id, data);
  res.status(201).json({ data: rows[0] });
}));

adminRouter.get("/admin/articles", asyncHandler(async (req, res) => {
  const { storeId } = optionalStoreId.parse(req.query);
  const where = storeWhere(storeId, "a.");
  const { rows } = await query(`select a.*, st.name as store_name from articles a left join stores st on st.id=a.store_id where true ${where.sql} order by a.published_at desc nulls last, a.id desc`, where.params);
  res.json({ data: rows });
}));

adminRouter.post("/admin/articles", asyncHandler(async (req, res) => {
  const data = z.object({
    storeId: z.number().int().positive().optional(),
    title: z.string().min(1).max(160),
    summary: z.string().max(260).optional(),
    content: z.string().optional(),
    coverUrl: z.string().optional(),
    category: z.string().max(60).optional(),
    readMinutes: z.coerce.number().int().positive().default(3),
    status: z.enum(["draft", "published"]).default("draft")
  }).parse(req.body);
  const { rows } = await query(
    `insert into articles (store_id, title, summary, content, cover_url, category, read_minutes, status, published_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,case when $8='published' then now() else null end) returning *`,
    [data.storeId || null, data.title, emptyToNull(data.summary), emptyToNull(data.content), emptyToNull(data.coverUrl), emptyToNull(data.category), data.readMinutes, data.status]
  );
  await audit(req, "create_article", "article", rows[0].id, data);
  res.status(201).json({ data: rows[0] });
}));

adminRouter.get("/admin/users", asyncHandler(async (req, res) => {
  const params = z.object({
    keyword: z.string().optional(),
    adminRole: z.enum(["member", "frontdesk", "manager", "owner"]).optional(),
    canManage: z.coerce.boolean().optional()
  }).parse(req.query);
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
  const { rows } = await query(
    `select u.id, u.nickname, u.phone, u.member_level, u.points, u.admin_role, u.can_manage, u.created_at,
            count(a.id)::int as appointment_count,
            coalesce(sum(a.amount) filter (where a.status in ('confirmed','completed')),0)::numeric(12,2) as total_spend
       from users u
       left join appointments a on a.user_id = u.id
      ${where}
      group by u.id
      order by u.id desc`,
    values
  );
  res.json({ data: rows });
}));

adminRouter.patch("/admin/users/:id/role", asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = z.object({
    adminRole: z.enum(["member", "frontdesk", "manager", "owner"]),
    canManage: z.boolean()
  }).parse(req.body);
  const { rows } = await query(
    `update users set admin_role=$1, can_manage=$2, updated_at=now() where id=$3
     returning id, nickname, admin_role, can_manage`,
    [data.adminRole, data.canManage, id]
  );
  await audit(req, "update_user_role", "user", id, data);
  res.json({ data: rows[0] });
}));

adminRouter.get("/admin/reviews", asyncHandler(async (req, res) => {
  const params = z.object({
    keyword: z.string().optional(),
    status: z.enum(["visible", "hidden"]).optional(),
    rating: z.coerce.number().int().min(1).max(5).optional()
  }).parse(req.query);
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
  const { rows } = await query(
    `select r.*, u.nickname as user_name, p.name as practitioner_name, st.name as store_name
       from reviews r
       left join users u on u.id = r.user_id
       left join practitioners p on p.id = r.practitioner_id
       left join stores st on st.id = r.store_id
      ${where}
      order by r.created_at desc`,
    values
  );
  res.json({ data: rows });
}));

adminRouter.patch("/admin/reviews/:id", asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = z.object({
    reply: z.string().max(500).optional(),
    status: z.enum(["visible", "hidden"]).default("visible")
  }).parse(req.body);
  const { rows } = await query(`update reviews set reply=$1, status=$2 where id=$3 returning *`, [emptyToNull(data.reply), data.status, id]);
  if (!rows[0]) return res.status(404).json({ message: "评价不存在" });
  await audit(req, "update_review", "review", id, data);
  res.json({ data: rows[0] });
}));

adminRouter.get("/admin/audit-logs", asyncHandler(async (req, res) => {
  const params = z.object({
    keyword: z.string().optional(),
    action: z.string().optional(),
    targetType: z.string().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  }).parse(req.query);
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
  const { rows } = await query(
    `select l.*, u.nickname as user_name
       from admin_audit_logs l
       left join users u on u.id = l.user_id
      ${where}
      order by l.created_at desc
      limit 100`,
    values
  );
  res.json({ data: rows });
}));
