import { Hono } from "hono";
import { z } from "zod";
import { query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const catalogRouter = () => {
  const app = new Hono();
  const storeQuery = z.object({ storeId: z.coerce.number().int().positive().optional() });

  function storeFilter(storeId, alias = "") {
    return storeId
      ? { sql: ` and (${alias}store_id = $1 or ${alias}store_id is null)`, params: [storeId] }
      : { sql: "", params: [] };
  }

  app.get("/stores/:id", asyncHandler(async (c) => {
    const id = z.coerce.number().int().positive().parse(Number(c.req.param("id")));
    const { rows } = await query(
      `select id, name, city, address, phone, business_hours, latitude, longitude, is_default
         from stores
        where id = $1 and status = 'active'`,
      [id]
    );
    if (!rows[0]) return c.json({ error: { code: "NOT_FOUND", message: "门店不存在" } }, 404);
    return c.json({ data: rows[0] });
  }));

  app.get("/stores", asyncHandler(async (c) => {
    const { rows } = await query(
      `select id, name, city, address, phone, business_hours, latitude, longitude, is_default
         from stores
        where status = 'active'
        order by is_default desc, id`
    );
    return c.json({ data: rows });
  }));

  app.get("/homepage-configs", asyncHandler(async (c) => {
    const { storeId } = storeQuery.parse(c.req.query());
    const filter = storeFilter(storeId);
    const { rows } = await query(
      `select id, store_id, section_key, title, payload, sort_order
         from homepage_configs
        where is_active = true ${filter.sql}
        order by sort_order desc, id desc`,
      filter.params
    );
    return c.json({ data: rows });
  }));

  app.get("/activities", asyncHandler(async (c) => {
    const { storeId } = storeQuery.parse(c.req.query());
    const filter = storeFilter(storeId);
    const { rows } = await query(
      `select id, title, subtitle, cover_url, price, original_price, tag, starts_at, ends_at
         from activities
        where is_active = true ${filter.sql}
        order by sort_order desc, id desc`,
      filter.params
    );
    return c.json({ data: rows });
  }));

  app.get("/articles", asyncHandler(async (c) => {
    const { storeId } = storeQuery.parse(c.req.query());
    const filter = storeFilter(storeId);
    const { rows } = await query(
      `select id, title, summary, cover_url, category, read_minutes, published_at
         from articles
        where status = 'published' ${filter.sql}
        order by published_at desc`,
      filter.params
    );
    return c.json({ data: rows });
  }));

  app.get("/services", asyncHandler(async (c) => {
    const schema = z.object({
      storeId: z.coerce.number().int().positive().optional(),
      category: z.string().max(60).optional(),
      tenantId: z.coerce.number().int().positive().optional()
    });
    const { storeId, category, tenantId } = schema.parse(c.req.query());
    const filter = storeFilter(storeId);
    const params = [...filter.params];
    let extra = filter.sql;
    if (category) { extra += ` and category = $${params.length + 1}`; params.push(category); }
    if (tenantId) { extra += ` and tenant_id = $${params.length + 1}`; params.push(tenantId); }
    const { rows } = await query(
      `select id, name, category, goods_type, description, duration_minutes, price, cover_url
         from services
        where is_active = true ${extra}
        order by sort_order desc, id desc`,
      params
    );
    return c.json({ data: rows });
  }));

  // R8 区块数据来源：会员卡 / 次卡（特殊商品类型）
  app.get("/membership-cards", asyncHandler(async (c) => {
    const schema = z.object({
      tenantId: z.coerce.number().int().positive().optional(),
      tenantSlug: z.string().max(80).optional(),
      storeId: z.coerce.number().int().positive().optional()
    });
    const { tenantId, tenantSlug, storeId } = schema.parse(c.req.query());
    let tid = tenantId;
    if (!tid && tenantSlug) {
      const t = await query(`select id from tenants where slug = $1`, [tenantSlug]);
      tid = t.rows[0]?.id;
    }
    if (!tid) return c.json({ error: { code: "TENANT_REQUIRED", message: "缺少租户" } }, 400);
    const params = [tid];
    let sql = `select id, tenant_id, store_id, name, type, sessions, validity_days, price, description, sort_order
                 from membership_cards where is_active = true and tenant_id = $1`;
    if (storeId) { sql += ` and (store_id = $2 or store_id is null)`; params.push(storeId); }
    sql += ` order by sort_order asc, id`;
    const { rows } = await query(sql, params);
    return c.json({ data: rows });
  }));

  app.get("/practitioners", asyncHandler(async (c) => {
    const schema = z.object({
      serviceId: z.coerce.number().int().positive().optional(),
      storeId: z.coerce.number().int().positive().optional()
    });
    const { serviceId, storeId } = schema.parse(c.req.query());

    const sql = serviceId
      ? `select p.id, p.name, p.title, p.avatar_url, p.bio, p.specialties, p.rating
           from practitioners p
           join practitioner_services ps on ps.practitioner_id = p.id
          where p.status = 'active'
            and ps.service_id = $1
            ${storeId ? "and (p.store_id = $2 or p.store_id is null)" : ""}
          order by p.rating desc`
      : `select id, name, title, avatar_url, bio, specialties, rating
           from practitioners
          where status = 'active'
            ${storeId ? "and (store_id = $1 or store_id is null)" : ""}
          order by rating desc`;

    const params = serviceId
      ? [serviceId, ...(storeId ? [storeId] : [])]
      : storeId ? [storeId] : [];
    const { rows } = await query(sql, params);
    return c.json({ data: rows });
  }));

  return app;
};
