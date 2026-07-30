import { Hono } from "hono";
import { z } from "zod";
import { query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { createAppointment, listAvailableSlots } from "../services/booking-service.js";

export const appointmentsRouter = () => {
  const app = new Hono();

  app.get("/schedules", asyncHandler(async (c) => {
    const schema = z.object({
      practitionerId: z.coerce.number().int().positive(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      storeId: z.coerce.number().int().positive().optional()
    });

    const params = schema.parse(c.req.query());
    const data = await listAvailableSlots(params);
    return c.json({ data });
  }));

  app.post("/appointments", asyncHandler(async (c) => {
    const schema = z.object({
      serviceId: z.number().int().positive(),
      practitionerId: z.number().int().positive(),
      scheduleId: z.number().int().positive(),
      familyMemberId: z.number().int().positive().optional(),
      note: z.string().max(300).optional()
    });

    const payload = schema.parse(await c.req.json());
    const appointment = await createAppointment({
      ...payload,
      userId: c.get("user").id
    });

    return c.json({ data: appointment }, 201);
  }));

  app.get("/me/appointments", asyncHandler(async (c) => {
    const user = c.get("user");
    const { rows } = await query(
      `select a.id, a.order_no, a.status, a.payment_status, a.appointment_date::text as appointment_date,
              a.start_time, a.end_time, a.amount, a.note,
              s.name as service_name,
              p.name as practitioner_name,
              fm.name as family_member_name
         from appointments a
         join services s on s.id = a.service_id
         join practitioners p on p.id = a.practitioner_id
         left join family_members fm on fm.id = a.family_member_id
        where a.user_id = $1
        order by a.appointment_date desc, a.start_time desc`,
      [user.id]
    );

    return c.json({ data: rows });
  }));

  return app;
};
