import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { isProduction, maskPhone } from "../config/env.js";

export const ordersRouter = Router();

const idParam = z.object({ id: z.coerce.number().int().positive() });

const VALID_STATUS_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: ["refunded"],
  refunded: []
};

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

function audit(req, action, targetType, targetId, detail = {}) {
  query(
    `insert into admin_audit_logs (user_id, action, target_type, target_id, detail)
     values ($1,$2,$3,$4,$5)`,
    [req.user.id, action, targetType, targetId || null, detail]
  ).catch((err) => console.error("[audit]", err));
}

// ── 用户端订单详情 ──
ordersRouter.get("/me/appointments/:id", asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
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
    [id, req.user.id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "订单不存在" } });
  }
  res.json({ data: rows[0] });
}));

// ── 用户取消订单 ──
ordersRouter.patch("/me/appointments/:id/cancel", asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { reason } = z.object({ reason: z.string().max(200).optional() }).parse(req.body || {});

  const current = await query(`select a.*, p.name as practitioner_name, s.name as service_name from appointments a join practitioners p on p.id = a.practitioner_id join services s on s.id = a.service_id where a.id = $1 and a.user_id = $2`, [id, req.user.id]);
  if (!current.rows[0]) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "订单不存在" } });
  }

  const order = current.rows[0];
  const allowed = VALID_STATUS_TRANSITIONS[order.status];
  if (!allowed || !allowed.includes("cancelled")) {
    return res.status(409).json({ error: { code: "INVALID_TRANSITION", message: `订单状态 ${order.status} 不允许取消` } });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      `update appointments set status = 'cancelled', updated_at = now() where id = $1 returning *`,
      [id]
    );
    await client.query("commit");

    audit(req, "cancel_appointment", "appointment", id, { reason });
    await emitMessage(req.user.id, "appointment_cancelled",
      "预约已取消",
      `您的「${order.service_name}」预约（${order.appointment_date} ${order.start_time.slice(0, 5)}）已取消。`,
      id
    );
    res.json({ data: rows[0] });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}));

// ── 用户改期 ──
ordersRouter.patch("/me/appointments/:id/reschedule", asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = z.object({ scheduleId: z.coerce.number().int().positive() }).parse(req.body);

  const current = await query(`select a.* from appointments a where a.id = $1 and a.user_id = $2`, [id, req.user.id]);
  if (!current.rows[0]) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "订单不存在" } });
  }

  const order = current.rows[0];
  if (!["pending", "confirmed"].includes(order.status)) {
    return res.status(409).json({ error: { code: "INVALID_TRANSITION", message: `订单状态 ${order.status} 不允许改期` } });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const newSchedule = await client.query(`select * from schedules where id = $1 for update`, [data.scheduleId]);
    if (!newSchedule.rowCount) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "新时段不存在" } });
    }
    const slot = newSchedule.rows[0];

    const booked = await client.query(
      `select count(*)::int as booked_count from appointments where schedule_id = $1 and status in ('pending','confirmed')`,
      [data.scheduleId]
    );
    if (slot.status !== "open" || booked.rows[0].booked_count >= slot.capacity) {
      return res.status(409).json({ error: { code: "SLOT_UNAVAILABLE", message: "该时段已约满" } });
    }

    const { rows } = await client.query(
      `update appointments
          set schedule_id = $1, appointment_date = $2, start_time = $3, end_time = $4, updated_at = now()
        where id = $5 returning *`,
      [data.scheduleId, slot.work_date, slot.start_time, slot.end_time, id]
    );
    await client.query("commit");
    audit(req, "reschedule_appointment", "appointment", id, { newScheduleId: data.scheduleId });
    res.json({ data: rows[0] });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}));
