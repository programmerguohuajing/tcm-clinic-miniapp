import { randomUUID } from "node:crypto";
import { pool, query } from "../config/db.js";

export async function listAvailableSlots({ practitionerId, date, storeId }) {
  const params = [practitionerId, date];
  const storeClause = storeId ? `and s.store_id = $3` : "";
  if (storeId) params.push(storeId);
  const { rows } = await query(
    `select s.id,
            s.store_id,
            s.work_date::text as work_date,
            s.start_time,
            s.end_time,
            s.capacity,
            s.status,
            count(a.id) filter (where a.status in ('pending','confirmed'))::int as booked_count
       from schedules s
       left join appointments a on a.schedule_id = s.id
      where s.practitioner_id = $1
        and s.work_date = $2
        ${storeClause}
      group by s.id
      order by s.start_time`,
    params
  );

  return rows.map((slot) => ({
    ...slot,
    available: slot.status === "open" && slot.booked_count < slot.capacity
  }));
}

export async function createAppointment({
  userId,
  serviceId,
  practitionerId,
  scheduleId,
  familyMemberId,
  note
}) {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const duplicate = await client.query(
      `select exists(
        select 1 from appointments
        where user_id = $1 and schedule_id = $2
          and status in ('pending','confirmed')
      ) as duplicate`,
      [userId, scheduleId]
    );
    if (duplicate.rows[0].duplicate) {
      const error = new Error("您已预约了该时段，请勿重复预约");
      error.statusCode = 409;
      throw error;
    }

    const schedule = await client.query(
      `select *
         from schedules
        where id = $1
          and practitioner_id = $2
        for update`,
      [scheduleId, practitionerId]
    );

    if (!schedule.rowCount) {
      const error = new Error("排班不存在");
      error.statusCode = 404;
      throw error;
    }

    const slot = schedule.rows[0];
    const booked = await client.query(
      `select count(*)::int as booked_count
         from appointments
        where schedule_id = $1
          and status in ('pending','confirmed')`,
      [scheduleId]
    );
    slot.booked_count = booked.rows[0].booked_count;

    if (slot.status !== "open" || slot.booked_count >= slot.capacity) {
      const error = new Error("该时段已约满或不可预约");
      error.statusCode = 409;
      throw error;
    }

    const service = await client.query(
      `select id, name, price from services where id = $1 and is_active = true`,
      [serviceId]
    );

    if (!service.rowCount) {
      const error = new Error("服务项目不存在");
      error.statusCode = 404;
      throw error;
    }

    const orderNo = `TCM${randomUUID().slice(0, 8).toUpperCase()}`;
    const inserted = await client.query(
      `insert into appointments (
         order_no, user_id, family_member_id, service_id, practitioner_id,
         schedule_id, appointment_date, start_time, end_time, amount, note, store_id
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       returning *`,
      [
        orderNo,
        userId,
        familyMemberId || null,
        serviceId,
        practitionerId,
        scheduleId,
        slot.work_date,
        slot.start_time,
        slot.end_time,
        service.rows[0].price,
        note || null,
        slot.store_id
      ]
    );

    await client.query("commit");
    return inserted.rows[0];
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
