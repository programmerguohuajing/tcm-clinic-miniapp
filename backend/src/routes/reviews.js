import { Hono } from "hono";
import { z } from "zod";
import { query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const reviewsRouter = () => {
  const app = new Hono();

  app.post("/reviews", asyncHandler(async (c) => {
    const schema = z.object({
      appointmentId: z.coerce.number().int().positive(),
      rating: z.coerce.number().int().min(1).max(5),
      content: z.string().max(500).optional()
    });
    const user = c.get("user");
    const data = schema.parse(await c.req.json());

    const orderResult = await query(
      `select id, status, practitioner_id, store_id from appointments where id = $1 and user_id = $2`,
      [data.appointmentId, user.id]
    );
    if (!orderResult.rows[0]) {
      return c.json({ error: { code: "NOT_FOUND", message: "订单不存在" } }, 404);
    }
    if (orderResult.rows[0].status !== "completed") {
      return c.json({ error: { code: "INVALID_STATE", message: "仅已完成订单可评价" } }, 409);
    }

    const existingResult = await query(
      `select id from reviews where appointment_id = $1`,
      [data.appointmentId]
    );
    if (existingResult.rows[0]) {
      return c.json({ error: { code: "ALREADY_REVIEWED", message: "该订单已评价" } }, 409);
    }

    const order = orderResult.rows[0];
    const { rows } = await query(
      `insert into reviews (appointment_id, user_id, practitioner_id, store_id, rating, content)
       values ($1,$2,$3,$4,$5,$6) returning *`,
      [data.appointmentId, user.id, order.practitioner_id, order.store_id, data.rating, data.content || null]
    );
    return c.json({ data: rows[0] }, 201);
  }));

  app.get("/me/reviews", asyncHandler(async (c) => {
    const user = c.get("user");
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
      [user.id]
    );
    return c.json({ data: rows });
  }));

  return app;
};
