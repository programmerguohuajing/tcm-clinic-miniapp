import { SignJWT, jwtVerify } from "jose";
import { query } from "../config/db.js";
import { JWT_SECRET, DEMO_USER } from "../config/env.js";

async function findUserById(userId) {
  const { rows } = await query(
    `select u.id, u.nickname, u.phone, u.points, u.member_level, u.admin_role, u.can_manage, u.can_technician,
            p.id as technician_id
       from users u
       left join practitioners p on p.user_id = u.id
      where u.id = $1`,
    [userId]
  );
  return rows.rows[0] || null;
}

function bearerToken(c) {
  const authorization = c.req.header("authorization") || "";
  const [type, token] = authorization.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

export async function signUserToken(user, env) {
  const secret = new TextEncoder().encode(JWT_SECRET(env));
  const token = await new SignJWT({ sub: String(user.id) })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(env.JWT_EXPIRES_IN || "7d")
    .sign(secret);
  return token;
}

export async function attachCurrentUser(c, next) {
  try {
    const env = c.get("env") || c.env;
    const token = bearerToken(c);

    if (token) {
      const secret = new TextEncoder().encode(JWT_SECRET(env));
      const { payload } = await jwtVerify(token, secret);
      const user = await findUserById(Number(payload.sub));
      if (!user) {
        return c.json({ message: "登录状态无效" }, 401);
      }
      c.set("user", user);
      return next();
    }

    return c.json({ message: "请先登录" }, 401);
  } catch (_error) {
    return c.json({ message: "登录状态已过期，请重新登录" }, 401);
  }
}

export function requireAdmin(c, next) {
  if (!c.get("user")?.can_manage) {
    return c.json({ message: "当前用户没有管理端权限" }, 403);
  }
  return next();
}

export function requireRole(...roles) {
  return (c, next) => {
    if (!c.get("user")?.can_manage) {
      return c.json({ message: "当前用户没有管理端权限" }, 403);
    }
    if (roles.length && !roles.includes(c.get("user")?.admin_role)) {
      return c.json({ message: "当前角色无权执行此操作" }, 403);
    }
    return next();
  };
}

export function requireTechnician(c, next) {
  const user = c.get("user");
  if (!user?.can_technician || !user?.technician_id) {
    return c.json({ message: "当前用户没有技师端权限" }, 403);
  }
  return next();
}
