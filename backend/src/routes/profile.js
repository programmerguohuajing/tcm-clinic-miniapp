import { Hono } from "hono";
import { z } from "zod";
import { query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const profileRouter = () => {
  const app = new Hono();

  app.get("/profile/summary", asyncHandler(async (c) => {
    const user = c.get("user");
    const [[appointments], [coupons], [family]] = await Promise.all([
      query(`select count(*)::int as count from appointments where user_id = $1`, [user.id]).then((r) => r.rows),
      query(`select count(*)::int as count from coupons where user_id = $1 and status = 'unused'`, [user.id]).then((r) => r.rows),
      query(`select count(*)::int as count from family_members where user_id = $1`, [user.id]).then((r) => r.rows)
    ]);

    return c.json({
      data: {
        user,
        stats: {
          appointments: appointments.count,
          coupons: coupons.count,
          familyMembers: family.count
        }
      }
    });
  }));

  app.get("/family-members", asyncHandler(async (c) => {
    const user = c.get("user");
    const { rows } = await query(
      `select id, name, relation, gender, birthday, phone
         from family_members
        where user_id = $1
        order by id desc`,
      [user.id]
    );
    return c.json({ data: rows });
  }));

  app.post("/family-members", asyncHandler(async (c) => {
    const schema = z.object({
      name: z.string().min(1).max(30),
      relation: z.string().min(1).max(20),
      gender: z.enum(["male", "female", "unknown"]).default("unknown"),
      birthday: z.string().optional(),
      phone: z.string().max(30).optional()
    });

    const user = c.get("user");
    const payload = schema.parse(await c.req.json());
    const { rows } = await query(
      `insert into family_members (user_id, name, relation, gender, birthday, phone)
       values ($1,$2,$3,$4,$5,$6)
       returning id, name, relation, gender, birthday, phone`,
      [user.id, payload.name, payload.relation, payload.gender, payload.birthday || null, payload.phone || null]
    );

    return c.json({ data: rows[0] }, 201);
  }));

  return app;
};
