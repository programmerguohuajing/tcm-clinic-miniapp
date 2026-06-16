import { Router } from "express";
import { z } from "zod";
import { query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { signUserToken } from "../middleware/auth.js";

export const authRouter = Router();

const isProduction = process.env.NODE_ENV === "production";

async function fetchWechatSession(code) {
  const appid = process.env.WECHAT_APP_ID;
  const secret = process.env.WECHAT_APP_SECRET;

  if (!appid || !secret) {
    if (isProduction) {
      throw Object.assign(new Error("生产环境缺少 WECHAT_APP_ID 或 WECHAT_APP_SECRET"), { statusCode: 500 });
    }
    return { openid: `dev-openid-${code || "default"}` };
  }

  const params = new URLSearchParams({
    appid,
    secret,
    js_code: code,
    grant_type: "authorization_code"
  });
  const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${params}`);
  const payload = await response.json();

  if (!response.ok || payload.errcode) {
    throw Object.assign(new Error(payload.errmsg || "微信登录失败"), { statusCode: 502 });
  }

  return payload;
}

async function upsertWechatUser(openid) {
  const { rows } = await query(
    `insert into users (openid, nickname)
     values ($1, '微信用户')
     on conflict (openid) do update set updated_at = now()
     returning id, nickname, phone, points, member_level, admin_role, can_manage`,
    [openid]
  );
  return rows[0];
}

authRouter.post("/auth/wechat-login", asyncHandler(async (req, res) => {
  const schema = z.object({
    code: z.string().min(1).optional()
  });
  const { code } = schema.parse(req.body || {});

  if (isProduction && !code) {
    return res.status(400).json({ message: "缺少微信登录 code" });
  }

  const session = await fetchWechatSession(code);
  const user = await upsertWechatUser(session.openid);
  const token = signUserToken(user);

  res.json({
    data: {
      token,
      user
    }
  });
}));

authRouter.post("/auth/admin-login", asyncHandler(async (req, res) => {
  const schema = z.object({
    phone: z.string().min(1),
    password: z.string().min(1)
  });
  const { phone, password } = schema.parse(req.body || {});
  const expectedPhone = process.env.ADMIN_LOGIN_PHONE;
  const expectedPassword = process.env.ADMIN_LOGIN_PASSWORD;

  if (!expectedPhone || !expectedPassword) {
    if (isProduction) {
      return res.status(500).json({ message: "生产环境缺少 ADMIN_LOGIN_PHONE 或 ADMIN_LOGIN_PASSWORD" });
    }
    if (phone !== "13800000000" || password !== "admin123") {
      return res.status(401).json({ message: "手机号或密码错误" });
    }
  } else if (phone !== expectedPhone || password !== expectedPassword) {
    return res.status(401).json({ message: "手机号或密码错误" });
  }

  const { rows } = await query(
    `select id, nickname, phone, points, member_level, admin_role, can_manage
       from users
      where phone = $1
      limit 1`,
    [phone]
  );
  const user = rows[0];

  if (!user?.can_manage) {
    return res.status(403).json({ message: "当前用户没有管理端权限" });
  }

  res.json({
    data: {
      token: signUserToken(user),
      user
    }
  });
}));
