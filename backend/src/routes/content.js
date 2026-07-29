import { Router } from "express";
import { z } from "zod";
import { query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const contentRouter = Router();

// ── 文章详情 ──
contentRouter.get("/articles/:id", asyncHandler(async (req, res) => {
  const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const { rows } = await query(
    `select id, store_id, title, summary, content, cover_url, category, read_minutes, status, published_at
       from articles
      where id = $1 and status = 'published'`,
    [id]
  );
  if (!rows[0]) return res.status(404).json({ error: { code: "NOT_FOUND", message: "文章不存在" } });
  res.json({ data: rows[0] });
}));

// ── 活动详情 ──
contentRouter.get("/activities/:id", asyncHandler(async (req, res) => {
  const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const { rows } = await query(
    `select id, store_id, title, subtitle, cover_url, price, original_price, tag, starts_at, ends_at
       from activities
      where id = $1 and is_active = true`,
    [id]
  );
  if (!rows[0]) return res.status(404).json({ error: { code: "NOT_FOUND", message: "活动不存在" } });
  res.json({ data: rows[0] });
}));

// ── 我的优惠券 ──
contentRouter.get("/coupons", asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select id, title, amount, min_spend, status, expires_at, created_at
       from coupons
      where user_id = $1
      order by case status when 'unused' then 1 when 'used' then 2 when 'expired' then 3 end, created_at desc`,
    [req.user.id]
  );
  res.json({ data: rows });
}));
