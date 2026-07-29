import { Router } from "express";
import { z } from "zod";
import { query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const reviewsRouter = Router();

// ── 创建评价（需已完成订单）──
reviewsRouter.post("/reviews", asyncHandler(async (req, res) => {
  const schema = z.object({
    appointmentId: z.coerce.number().int().positive(),
    rating: z.coerce.number().int().min(1).max(5),
    content: z.string().max(500).optional()
  });
  const data = schema.parse(req.body);

  const order = await query(`select id, status, practitioner_id, store_id from appointments where id = $1 and user_id = $2`, [data.appointmentId, req.user.id]);
  if (!order.rows[0]) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "订单不存在" } });
  }
  if (order.rows[0].status !== "completed") {
    return res.status(409).json({ error: { code: "INVALID_STATE", message: "仅已完成订单可评价" } });
  }

  const existing = await query(`select id from reviews where appointment_id = $1`, [data.appointmentId]);
  if (existing.rows[0]) {
    return res.status(409).json({ error: { code: "ALREADY_REVIEWED", message: "该订单已评价" } });
  }

  const practitionerId = order.rows[0].practitioner_id;
  const storeId = order.rows[0].store_id;

  const { rows } = await query(
    `insert into reviews (appointment_id, user_id, practitioner_id, store_id, rating, content)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [data.appointmentId, req.user.id, practitionerId, storeId, data.rating, data.content || null]
  );
  res.status(201).json({ data: rows[0] });
}));

// ── 我的评价列表 ──
reviewsRouter.get("/me/reviews", asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select r.*, p.name as practitioner_name, st.name as store_name,
            s.name as service_name, a.appointment_date::text as appointment_date
       from reviews r
       join appointments a on a.id = r.appointment_id
       join practitioners p on p.id = r.practitioner_id
       left join stores st on st.id = r.store_id
       join services s on s.id = a.service_id
      where r.user_id = $1
      order by r.created_at desc`,
    [req.user.id]
  );
  res.json({ data: rows });
}));
