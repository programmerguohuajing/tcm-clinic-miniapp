import { Hono } from "hono";
import { z } from "zod";
import { query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const healthRecordsRouter = () => {
  const app = new Hono();

  app.get("/health-records", asyncHandler(async (c) => {
    const user = c.get("user");
    const { rows } = await query(
      `select id, constitution, symptoms, tongue_image_url, pulse_note, diagnosis_note, created_at
         from health_records
        where user_id = $1 and deleted_at is null
        order by created_at desc`,
      [user.id]
    );
    return c.json({ data: rows });
  }));

  app.post("/health-records", asyncHandler(async (c) => {
    const schema = z.object({
      constitution: z.string().min(1).max(80),
      symptoms: z.array(z.string()).default([]),
      tongueImageUrl: z.string().url().optional(),
      pulseNote: z.string().max(300).optional(),
      diagnosisNote: z.string().max(500).optional()
    });

    const user = c.get("user");
    const payload = schema.parse(await c.req.json());
    const { rows } = await query(
      `insert into health_records (user_id, constitution, symptoms, tongue_image_url, pulse_note, diagnosis_note)
       values ($1,$2,$3,$4,$5,$6)
       returning id, constitution, symptoms, tongue_image_url, pulse_note, diagnosis_note, created_at`,
      [user.id, payload.constitution, payload.symptoms, payload.tongueImageUrl || null, payload.pulseNote || null, payload.diagnosisNote || null]
    );

    return c.json({ data: rows[0] }, 201);
  }));

  app.delete("/health-records/:id", asyncHandler(async (c) => {
    const user = c.get("user");
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(c.req.param());
    const { rowCount } = await query(
      `update health_records set deleted_at = now()
        where id = $1 and user_id = $2 and deleted_at is null`,
      [id, user.id]
    );

    if (!rowCount) {
      return c.json({ error: { code: "NOT_FOUND", message: "档案不存在或无权删除" } }, 404);
    }

    return c.json({ data: { id } });
  }));

  return app;
};
