import { Router } from "express";
import { z } from "zod";
import { query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { createAppointment, listAvailableSlots } from "../services/booking-service.js";

export const appointmentsRouter = Router();

appointmentsRouter.get("/schedules", asyncHandler(async (req, res) => {
  const schema = z.object({
    practitionerId: z.coerce.number().int().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    storeId: z.coerce.number().int().positive().optional()
  });

  const params = schema.parse(req.query);
  const data = await listAvailableSlots(params);
  res.json({ data });
}));

appointmentsRouter.post("/appointments", asyncHandler(async (req, res) => {
  const schema = z.object({
    serviceId: z.number().int().positive(),
    practitionerId: z.number().int().positive(),
    scheduleId: z.number().int().positive(),
    familyMemberId: z.number().int().positive().optional(),
    note: z.string().max(300).optional()
  });

  const payload = schema.parse(req.body);
  const appointment = await createAppointment({
    ...payload,
    userId: req.user.id
  });

  res.status(201).json({ data: appointment });
}));

appointmentsRouter.get("/me/appointments", asyncHandler(async (req, res) => {
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
    [req.user.id]
  );

  res.json({ data: rows });
}));
