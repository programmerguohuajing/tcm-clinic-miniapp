import { Router } from "express";
import { z } from "zod";
import { query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const healthRecordsRouter = Router();

healthRecordsRouter.get("/health-records", asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select id, constitution, symptoms, tongue_image_url, pulse_note, diagnosis_note, created_at
       from health_records
      where user_id = $1 and deleted_at is null
      order by created_at desc`,
    [req.user.id]
  );
  res.json({ data: rows });
}));

healthRecordsRouter.post("/health-records", asyncHandler(async (req, res) => {
  const schema = z.object({
    constitution: z.string().min(1).max(80),
    symptoms: z.array(z.string()).default([]),
    tongueImageUrl: z.string().url().optional(),
    pulseNote: z.string().max(300).optional(),
    diagnosisNote: z.string().max(500).optional()
  });

  const payload = schema.parse(req.body);
  const { rows } = await query(
    `insert into health_records (
       user_id, constitution, symptoms, tongue_image_url, pulse_note, diagnosis_note
     )
     values ($1,$2,$3,$4,$5,$6)
     returning id, constitution, symptoms, tongue_image_url, pulse_note, diagnosis_note, created_at`,
    [
      req.user.id,
      payload.constitution,
      payload.symptoms,
      payload.tongueImageUrl || null,
      payload.pulseNote || null,
      payload.diagnosisNote || null
    ]
  );

  res.status(201).json({ data: rows[0] });
}));

healthRecordsRouter.delete("/health-records/:id", asyncHandler(async (req, res) => {
  const schema = z.object({ id: z.coerce.number().int().positive() });
  const { id } = schema.parse(req.params);
  const { rowCount } = await query(
    `update health_records set deleted_at = now()
      where id = $1 and user_id = $2 and deleted_at is null`,
    [id, req.user.id]
  );

  if (!rowCount) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "档案不存在或无权删除" } });
  }

  res.json({ data: { id } });
}));
