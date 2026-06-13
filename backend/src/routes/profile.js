import { Router } from "express";
import { z } from "zod";
import { query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const profileRouter = Router();

profileRouter.get("/profile/summary", asyncHandler(async (req, res) => {
  const [[appointments], [coupons], [family]] = await Promise.all([
    query(`select count(*)::int as count from appointments where user_id = $1`, [req.user.id]).then((r) => r.rows),
    query(`select count(*)::int as count from coupons where user_id = $1 and status = 'unused'`, [req.user.id]).then((r) => r.rows),
    query(`select count(*)::int as count from family_members where user_id = $1`, [req.user.id]).then((r) => r.rows)
  ]);

  res.json({
    data: {
      user: req.user,
      stats: {
        appointments: appointments.count,
        coupons: coupons.count,
        familyMembers: family.count
      }
    }
  });
}));

profileRouter.get("/family-members", asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select id, name, relation, gender, birthday, phone
       from family_members
      where user_id = $1
      order by id desc`,
    [req.user.id]
  );
  res.json({ data: rows });
}));

profileRouter.post("/family-members", asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(30),
    relation: z.string().min(1).max(20),
    gender: z.enum(["male", "female", "unknown"]).default("unknown"),
    birthday: z.string().optional(),
    phone: z.string().max(30).optional()
  });

  const payload = schema.parse(req.body);
  const { rows } = await query(
    `insert into family_members (user_id, name, relation, gender, birthday, phone)
     values ($1,$2,$3,$4,$5,$6)
     returning id, name, relation, gender, birthday, phone`,
    [req.user.id, payload.name, payload.relation, payload.gender, payload.birthday || null, payload.phone || null]
  );

  res.status(201).json({ data: rows[0] });
}));

