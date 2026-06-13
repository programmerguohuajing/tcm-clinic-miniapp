import { query } from "../config/db.js";

export async function attachDemoUser(req, _res, next) {
  const userId = Number(req.header("x-demo-user-id") || 1);

  const { rows } = await query(
    `select id, nickname, phone, points, member_level, admin_role, can_manage
       from users
      where id = $1`,
    [userId]
  );

  req.user = rows[0] || {
    id: 1,
    nickname: "体验用户",
    phone: "13800000000",
    points: 0,
    member_level: "青竹会员",
    admin_role: "member",
    can_manage: false
  };

  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user?.can_manage) {
    return res.status(403).json({ message: "当前用户没有管理端权限" });
  }

  next();
}
