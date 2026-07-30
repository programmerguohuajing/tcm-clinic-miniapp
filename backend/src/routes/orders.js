import { Hono } from "hono";
import { z } from "zod";
import { query } from "../config/db.js";
import { isProduction } from "../config/env.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { VALID_STATUS_TRANSITIONS } from "../config/constants.js";

export const ordersRouter = () => {
  const app = new Hono();

  async function emitMessage(userId, type, title, body, relatedId = null) {
    try {
      await query(
        `insert into messages (user_id, type, title, body, related_id)
         values ($1,$2,$3,$4,$5)`,
        [userId, type, title, body, relatedId]
      );
    } catch (err) {
      console.error("[messages] emit failed", err);
    }
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

  // User's order detail
  app.get("/me/appointments/:id", asyncHandler(async (c) => {
    const user = c.get("user");
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(c.req.param());
    const phoneExpr = isProduction() ? "mask_phone(u.phone)" : "u.phone";
    const { rows } = await query(
      `select a.id, a.order_no, a.status, a.payment_status, a.appointment_date::text as appointment_date,
              a.start_time, a.end_time, a.amount, a.note, a.verification_code,
              s.name as service_name, s.duration_minutes, s.cover_url,
              p.name as practitioner_name, p.title as practitioner_title, p.avatar_url,
              st.name as store_name, st.address as store_address, st.phone as store_phone,
              fm.name as family_member_name,
              ${phoneExpr} as user_phone
         from appointments a
         join services s on s.id = a.service_id
         join practitioners p on p.id = a.practitioner_id
         left join stores st on st.id = a.store_id
         left join family_members fm on fm.id = a.family_member_id
         join users u on u.id = a.user_id
        where a.id = $1 and a.user_id = $2`,
      [id, user.id]
    );

    if (!rows[0]) {
      return c.json({ error: { code: "NOT_FOUND", message: "订单不存在" } }, 404);
    }
    return c.json({ data: rows[0] });
  }));

  // User cancels appointment
  app.patch("/me/appointments/:id/cancel", asyncHandler(async (c) => {
    const user = c.get("user");
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(c.req.param());
    const { reason } = z.object({ reason: z.string().max(200).optional() }).parse(await c.req.json());

    const currentResult = await query(
      `select a.*, p.name as practitioner_name, s.name as service_name
         from appointments a
         join practitioners p on p.id = a.practitioner_id
         join services s on s.id = a.service_id
        where a.id = $1 and a.user_id = $2`,
      [id, user.id]
    );
    if (!currentResult.rows[0]) {
      return c.json({ error: { code: "NOT_FOUND", message: "订单不存在" } }, 404);
    }

    const order = currentResult.rows[0];
    const allowed = VALID_STATUS_TRANSITIONS[order.status];
    if (!allowed || !allowed.includes("cancelled")) {
      return c.json({ error: { code: "INVALID_TRANSITION", message: `订单状态 ${order.status} 不允许取消` } }, 409);
    }

    const { rows } = await query(
      `update appointments set status = 'cancelled', updated_at = now() where id = $1 returning *`,
      [id]
    );

    await audit(c, "cancel_appointment", "appointment", id, { reason });
    await emitMessage(user.id, "appointment_cancelled",
      "预约已取消",
      `您的「${order.service_name}」预约（${order.appointment_date} ${order.start_time.slice(0, 5)}）已取消。`,
      id
    );
    return c.json({ data: rows[0] });
  }));

  // User reschedules appointment
  app.patch("/me/appointments/:id/reschedule", asyncHandler(async (c) => {
    const user = c.get("user");
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(c.req.param());
    const { scheduleId } = z.object({ scheduleId: z.coerce.number().int().positive() }).parse(await c.req.json());

    const currentResult = await query(
      `select a.* from appointments a where a.id = $1 and a.user_id = $2`,
      [id, user.id]
    );
    if (!currentResult.rows[0]) {
      return c.json({ error: { code: "NOT_FOUND", message: "订单不存在" } }, 404);
    }

    const order = currentResult.rows[0];
    if (!["pending", "confirmed"].includes(order.status)) {
      return c.json({ error: { code: "INVALID_TRANSITION", message: `订单状态 ${order.status} 不允许改期` } }, 409);
    }

    // Read new schedule and check availability
    const newScheduleResult = await query(
      `select * from schedules where id = $1`,
      [scheduleId]
    );
    if (!newScheduleResult.rows[0]) {
      return c.json({ error: { code: "NOT_FOUND", message: "新时段不存在" } }, 404);
    }

    const slot = newScheduleResult.rows[0];
    const bookedResult = await query(
      `select count(*)::int as booked_count from appointments where schedule_id = $1 and status in ('pending','confirmed')`,
      [scheduleId]
    );
    const bookedCount = bookedResult.rows[0]?.booked_count || 0;

    if (slot.status !== "open" || bookedCount >= slot.capacity) {
      return c.json({ error: { code: "SLOT_UNAVAILABLE", message: "该时段已约满" } }, 409);
    }

    // Atomic update — use simple non-interactive transaction
    try {
      const result = await tx([
        [
          `update appointments set schedule_id=$1, appointment_date=$2, start_time=$3, end_time=$4, updated_at=now() where id=$5 returning *`,
          [scheduleId, slot.work_date, slot.start_time, slot.end_time, id]
        ]
      ]);
      await audit(c, "reschedule_appointment", "appointment", id, { newScheduleId: scheduleId });
      return c.json({ data: result[0].rows[0] });
    } catch (err) {
      return c.json({ error: { code: "ERROR", message: err.message } }, 500);
    }
  }));

  return app;
};
