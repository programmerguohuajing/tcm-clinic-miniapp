import { query } from "../config/db.js";

/**
 * List available time slots for a practitioner on a given date.
 */
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

/**
 * Create an appointment.
 *
 * Concurrency safety: the database has a BEFORE INSERT trigger
 * (`enforce_schedule_capacity`) that atomically checks capacity.
 * If two concurrent requests pass the pre-check, the database
 * will reject the second one with "该时段已约满".
 */
export async function createAppointment({
  userId,
  serviceId,
  practitionerId,
  scheduleId,
  familyMemberId,
  note
}) {
  // Fast-fail: check for duplicate booking window
  const dupResult = await query(
    `select exists(
       select 1 from appointments a
       join schedules s on s.id = a.schedule_id
       where a.user_id = $1 and a.schedule_id = $2
         and a.status in ('pending','confirmed')
     ) as duplicate_slot,
     exists(
       select 1 from appointments a
        where a.user_id = $1
          and a.appointment_date = (select work_date from schedules where id = $2)
          and a.start_time = (select start_time from schedules where id = $2)
          and a.end_time = (select end_time from schedules where id = $2)
          and a.status in ('pending','confirmed')
     ) as duplicate_window`,
    [userId, scheduleId]
  );

  if (dupResult.rows[0]?.duplicate_slot) {
    const err = new Error("您已预约了该时段，请勿重复预约");
    err.statusCode = 409;
    throw err;
  }
  if (dupResult.rows[0]?.duplicate_window) {
    const err = new Error("您在同一时间段内已有其他预约");
    err.statusCode = 409;
    throw err;
  }

  // Fast-fail: verify service exists and get price
  const svcResult = await query(
    `select id, name, price from services where id = $1 and is_active = true`,
    [serviceId]
  );

  if (!svcResult.rows[0]?.id) {
    const err = new Error("服务项目不存在");
    err.statusCode = 404;
    throw err;
  }

  const service = svcResult.rows[0];
  const orderNo = `TCM${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  // Atomic INSERT — SELECT validates schedule exists and belongs to practitioner
  // DB trigger (enforce_schedule_capacity) enforces capacity atomically
  try {
    const { rows } = await query(
      `insert into appointments (
         order_no, user_id, family_member_id, service_id, practitioner_id,
         schedule_id, appointment_date, start_time, end_time, amount, note, store_id
       )
       select $9,$2,$3,$4,$5,$6,s.work_date,s.start_time,s.end_time,$1,$10,s.store_id
         from schedules s
        where s.id = $7 and s.practitioner_id = $8
       returning *`,
      [
        service.price,  // $1 amount
        userId,         // $2
        familyMemberId || null, // $3
        serviceId,      // $4
        practitionerId, // $5
        scheduleId,     // $6
        scheduleId,     // $7 (WHERE)
        practitionerId, // $8 (WHERE)
        orderNo,        // $9
        note || null    // $10
      ]
    );
    return rows[0];
  } catch (err) {
    // Handle DB trigger rejection
    if (err.message?.includes("已约满") || err.message?.includes("已关闭") || err.message?.includes("排班不存在")) {
      const e = new Error(err.message);
      e.statusCode = 409;
      throw e;
    }
    throw err;
  }
}
