import jwt from "jsonwebtoken";
import { query } from "../config/db.js";

const isProduction = process.env.NODE_ENV === "production";

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (isProduction) {
    throw Object.assign(new Error("生产环境缺少 JWT_SECRET"), { statusCode: 500 });
  }
  return "dev-only-jwt-secret";
}

export function signUserToken(user) {
  return jwt.sign({ sub: String(user.id) }, jwtSecret(), { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
}

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

export async function attachCurrentUser(req, res, next) {
  try {
    if (!isProduction && req.header("x-demo-user-id")) {
      const userId = Number(req.header("x-demo-user-id") || 1);
      req.user = await findUserById(userId) || {
        id: 1,
        nickname: "体验用户",
        phone: "13800000000",
        points: 0,
        member_level: "青竹会员",
        admin_role: "member",
        can_manage: false,
        can_technician: false,
        technician_id: null
      };
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

    if (!isProduction) {
      const userId = 1;
      req.user = await findUserById(userId) || {
        id: 1,
        nickname: "体验用户",
        phone: "13800000000",
        points: 0,
        member_level: "青竹会员",
        admin_role: "member",
        can_manage: false,
        can_technician: false,
        technician_id: null
      };
      return next();
    }

    return res.status(401).json({ message: "请先登录" });
  } catch (_error) {
    if (!isProduction) {
      req.user = await findUserById(1) || {
        id: 1,
        nickname: "体验用户",
        phone: "13800000000",
        points: 0,
        member_level: "青竹会员",
        admin_role: "member",
        can_manage: false,
        can_technician: false,
        technician_id: null
      };
      return next();
    }
    return res.status(401).json({ message: "登录状态已过期，请重新登录" });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user?.can_manage) {
    return res.status(403).json({ message: "当前用户没有管理端权限" });
  }

  next();
}
