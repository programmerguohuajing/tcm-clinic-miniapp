import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const userRouter = Router();

// ── 模拟支付：创建支付单 ──
userRouter.post("/me/appointments/:id/pay", asyncHandler(async (req, res) => {
  const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);

  const current = await query(`select a.*, s.name as service_name, p.name as practitioner_name from appointments a join services s on s.id = a.service_id join practitioners p on p.id = a.practitioner_id where a.id = $1 and a.user_id = $2`, [id, req.user.id]);
  if (!current.rows[0]) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "订单不存在" } });
  }
  const order = current.rows[0];
  if (order.status === "cancelled" || order.status === "refunded") {
    return res.status(409).json({ error: { code: "INVALID_STATE", message: "已取消/退款的订单不可支付" } });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      `update appointments set payment_status = 'paid', status = 'confirmed', updated_at = now() where id = $1 returning *`,
      [id]
    );
    await client.query("commit");

    await query(
      `insert into messages (user_id, type, title, body, related_id) values ($1,$2,$3,$4,$5)`,
      [req.user.id, "payment_success", "支付成功",
        `您已完成支付 ¥${order.amount}，订单号 ${order.order_no}。`, id]
    ).catch((err) => console.error("[messages] pay emit failed", err));
    res.json({ data: { ...rows[0], paid: true } });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}));

// ── 支付确认（模拟回调）──
userRouter.post("/me/appointments/:id/pay/confirm", asyncHandler(async (req, res) => {
  const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const { rows } = await query(
    `update appointments set payment_status = 'paid', status = 'confirmed', updated_at = now() where id = $1 and user_id = $2 returning *`,
    [id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: { code: "NOT_FOUND", message: "订单不存在" } });
  res.json({ data: rows[0] });
}));

// ── 技师详情 ──
userRouter.get("/practitioners/:id", asyncHandler(async (req, res) => {
  const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const { rows } = await query(
    `select p.id, p.name, p.title, p.avatar_url, p.bio, p.specialties, p.rating,
            p.certificates, st.name as store_name, st.address as store_address
       from practitioners p
       left join stores st on st.id = p.store_id
      where p.id = $1 and p.status = 'active'`,
    [id]
  );
  if (!rows[0]) return res.status(404).json({ error: { code: "NOT_FOUND", message: "技师不存在" } });
  res.json({ data: rows[0] });
}));

// ── 我的消息列表 ──
userRouter.get("/me/messages", asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select id, type, title, body, related_id, is_read, created_at
       from messages
      where user_id = $1
      order by created_at desc
      limit 100`,
    [req.user.id]
  );
  res.json({ data: rows });
}));

// ── 标记消息已读 ──
userRouter.patch("/me/messages/:id/read", asyncHandler(async (req, res) => {
  const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const { rows } = await query(`update messages set is_read = true where id = $1 and user_id = $2 returning id`, [id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: { code: "NOT_FOUND", message: "消息不存在" } });
  res.json({ data: { id } });
}));
