import { Hono } from "hono";
import { z } from "zod";
import { query, tx } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const userRouter = () => {
  const app = new Hono();

  // Mock payment: create payment and confirm immediately
  app.post("/me/appointments/:id/pay", asyncHandler(async (c) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(c.req.param());
    const user = c.get("user");

    const orderResult = await query(
      `select a.*, s.name as service_name, p.name as practitioner_name
         from appointments a
         join services s on s.id = a.service_id
         join practitioners p on p.id = a.practitioner_id
        where a.id = $1 and a.user_id = $2`,
      [id, user.id]
    );
    if (!orderResult.rows[0]) {
      return c.json({ error: { code: "NOT_FOUND", message: "订单不存在" } }, 404);
    }
    const order = orderResult.rows[0];
    if (order.status === "cancelled" || order.status === "refunded") {
      return c.json({ error: { code: "INVALID_STATE", message: "已取消/退款的订单不可支付" } }, 409);
    }

    const { rows } = await query(
      `update appointments
          set payment_status = 'paid', status = 'confirmed', updated_at = now()
        where id = $1 returning *`,
      [id]
    );

    await query(
      `insert into messages (user_id, type, title, body, related_id) values ($1,$2,$3,$4,$5)`,
      [user.id, "payment_success", "支付成功",
        `您已完成支付 ¥${order.amount}，订单号 ${order.order_no}。`, id]
    ).catch((err) => console.error("[messages] pay emit failed", err));

    return c.json({ data: { ...rows[0], paid: true } });
  }));

  // Payment confirm (mock callback)
  app.post("/me/appointments/:id/pay/confirm", asyncHandler(async (c) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(c.req.param());
    const user = c.get("user");
    const { rows } = await query(
      `update appointments set payment_status = 'paid', status = 'confirmed', updated_at = now()
        where id = $1 and user_id = $2 returning *`,
      [id, user.id]
    );
    if (!rows[0]) return c.json({ error: { code: "NOT_FOUND", message: "订单不存在" } }, 404);
    return c.json({ data: rows[0] });
  }));

  // Practitioner detail
  app.get("/practitioners/:id", asyncHandler(async (c) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(c.req.param());
    const { rows } = await query(
      `select p.id, p.name, p.title, p.avatar_url, p.bio, p.specialties, p.rating,
              p.certificates, st.name as store_name, st.address as store_address
         from practitioners p
         left join stores st on st.id = p.store_id
        where p.id = $1 and p.status = 'active'`,
      [id]
    );
    if (!rows[0]) return c.json({ error: { code: "NOT_FOUND", message: "技师不存在" } }, 404);
    return c.json({ data: rows[0] });
  }));

  // My messages
  app.get("/me/messages", asyncHandler(async (c) => {
    const user = c.get("user");
    const { rows } = await query(
      `select id, type, title, body, related_id, is_read, created_at
         from messages
        where user_id = $1
        order by created_at desc
        limit 100`,
      [user.id]
    );
    return c.json({ data: rows });
  }));

  // Mark message as read
  app.patch("/me/messages/:id/read", asyncHandler(async (c) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(c.req.param());
    const user = c.get("user");
    const { rows } = await query(
      `update messages set is_read = true where id = $1 and user_id = $2 returning id`,
      [id, user.id]
    );
    if (!rows[0]) return c.json({ error: { code: "NOT_FOUND", message: "消息不存在" } }, 404);
    return c.json({ data: { id } });
  }));

  return app;
};
