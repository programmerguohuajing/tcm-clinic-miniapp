import jwt from "jsonwebtoken";
import { query } from "../config/db.js";
import { isProduction, jwtSecret, DEMO_USER } from "../config/env.js";

async function findUserById(userId) {
  const { rows } = await query(
    `select u.id, u.nickname, u.phone, u.points, u.member_level, u.admin_role, u.can_manage, u.can_technician,
            p.id as technician_id
       from users u
       left join practitioners p on p.user_id = u.id
      where u.id = $1`,
    [userId]
  );
  return rows[0] || null;
}

function bearerToken(req) {
  const authorization = req.header("authorization") || "";
  const [type, token] = authorization.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

export function signUserToken(user) {
  return jwt.sign({ sub: String(user.id) }, jwtSecret(), { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
}

export async function attachCurrentUser(req, res, next) {
  try {
    if (!isProduction() && req.header("x-demo-user-id")) {
      const userId = Number(req.header("x-demo-user-id") || 1);
      console.warn(`[auth] DEV: using x-demo-user-id=${userId}`);
      req.user = await findUserById(userId) || { ...DEMO_USER };
      return next();
    }

    const token = bearerToken(req);
    if (token) {
      const payload = jwt.verify(token, jwtSecret());
      const user = await findUserById(Number(payload.sub));
      if (!user) return res.status(401).json({ message: "登录状态无效" });
      req.user = user;
      return next();
    }

    if (!isProduction()) {
      console.warn("[auth] DEV: no token, auto-attach demo user (id=1)");
      req.user = await findUserById(1) || { ...DEMO_USER };
      return next();
    }

    return res.status(401).json({ message: "请先登录" });
  } catch (_error) {
    return res.status(401).json({ message: "登录状态已过期，请重新登录" });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user?.can_manage) {
    return res.status(403).json({ message: "当前用户没有管理端权限" });
  }

  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user?.can_manage) {
      return res.status(403).json({ message: "当前用户没有管理端权限" });
    }
    if (roles.length && !roles.includes(req.user.admin_role)) {
      return res.status(403).json({ message: "当前角色无权执行此操作" });
    }
    next();
  };
}
