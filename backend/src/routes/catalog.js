import { Router } from "express";
import { z } from "zod";
import { query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const catalogRouter = Router();

const storeQuery = z.object({
  storeId: z.coerce.number().int().positive().optional()
});

function storeFilter(storeId, alias = "") {
  return storeId ? { sql: ` and (${alias}store_id = $1 or ${alias}store_id is null)`, params: [storeId] } : { sql: "", params: [] };
}

catalogRouter.get("/stores", asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `select id, name, city, address, phone, business_hours, latitude, longitude, is_default
       from stores
      where status = 'active'
      order by is_default desc, id`
  );
  res.json({ data: rows });
}));

catalogRouter.get("/homepage-configs", asyncHandler(async (req, res) => {
  const { storeId } = storeQuery.parse(req.query);
  const filter = storeFilter(storeId);
  const { rows } = await query(
    `select id, store_id, section_key, title, payload, sort_order
       from homepage_configs
      where is_active = true ${filter.sql}
      order by sort_order desc, id desc`,
    filter.params
  );
  res.json({ data: rows });
}));

catalogRouter.get("/activities", asyncHandler(async (req, res) => {
  const { storeId } = storeQuery.parse(req.query);
  const filter = storeFilter(storeId);
  const { rows } = await query(
    `select id, title, subtitle, cover_url, price, original_price, tag, starts_at, ends_at
       from activities
      where is_active = true ${filter.sql}
      order by sort_order desc, id desc`,
    filter.params
  );
  res.json({ data: rows });
}));

catalogRouter.get("/articles", asyncHandler(async (req, res) => {
  const { storeId } = storeQuery.parse(req.query);
  const filter = storeFilter(storeId);
  const { rows } = await query(
    `select id, title, summary, cover_url, category, read_minutes, published_at
       from articles
      where status = 'published' ${filter.sql}
      order by published_at desc`,
    filter.params
  );
  res.json({ data: rows });
}));

catalogRouter.get("/services", asyncHandler(async (req, res) => {
  const { storeId } = storeQuery.parse(req.query);
  const filter = storeFilter(storeId);
  const { rows } = await query(
    `select id, name, category, description, duration_minutes, price, cover_url
       from services
      where is_active = true ${filter.sql}
      order by sort_order desc, id desc`,
    filter.params
  );
  res.json({ data: rows });
}));

catalogRouter.get("/practitioners", asyncHandler(async (req, res) => {
  const schema = z.object({
    serviceId: z.coerce.number().int().positive().optional(),
    storeId: z.coerce.number().int().positive().optional()
  });
  const { serviceId, storeId } = schema.parse(req.query);

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

  const params = serviceId ? [serviceId, ...(storeId ? [storeId] : [])] : (storeId ? [storeId] : []);
  const { rows } = await query(sql, params);
  res.json({ data: rows });
}));
