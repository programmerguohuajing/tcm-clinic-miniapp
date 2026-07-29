import { Router } from "express";
import { z } from "zod";
import { query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const favoritesRouter = Router();

favoritesRouter.get("/me/favorites", asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select f.id, f.target_type, f.target_id, f.created_at,
            st.name as store_name, st.address as store_address,
            p.name as practitioner_name, p.title as practitioner_title, p.avatar_url, p.rating
       from user_favorites f
       left join stores st on st.id = f.target_id and f.target_type = 'store'
       left join practitioners p on p.id = f.target_id and f.target_type = 'practitioner'
      where f.user_id = $1
      order by f.created_at desc`,
    [req.user.id]
  );
  res.json({ data: rows });
}));

favoritesRouter.post("/me/favorites", asyncHandler(async (req, res) => {
  const data = z.object({
    targetType: z.enum(["store", "practitioner"]),
    targetId: z.coerce.number().int().positive()
  }).parse(req.body);

  if (data.targetType === "store") {
    const exists = await query(`select 1 from stores where id = $1`, [data.targetId]);
    if (!exists.rows[0]) return res.status(404).json({ error: { code: "NOT_FOUND", message: "门店不存在" } });
  } else {
    const exists = await query(`select 1 from practitioners where id = $1 and status = 'active'`, [data.targetId]);
    if (!exists.rows[0]) return res.status(404).json({ error: { code: "NOT_FOUND", message: "技师不存在" } });
  }

  const { rows } = await query(
    `insert into user_favorites (user_id, target_type, target_id)
     values ($1,$2,$3) on conflict (user_id, target_type, target_id) do nothing returning *`,
    [req.user.id, data.targetType, data.targetId]
  );
  res.status(201).json({ data: rows[0] || { targetType: data.targetType, targetId: data.targetId } });
}));

favoritesRouter.delete("/me/favorites/:id", asyncHandler(async (req, res) => {
  const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const result = await query(`delete from user_favorites where id = $1 and user_id = $2 returning id`, [id, req.user.id]);
  if (!result.rows[0]) return res.status(404).json({ error: { code: "NOT_FOUND", message: "收藏不存在" } });
  res.json({ data: { id } });
}));
