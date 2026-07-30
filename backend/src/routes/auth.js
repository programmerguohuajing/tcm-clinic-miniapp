import { Hono } from "hono";
import { z } from "zod";
import { JWT_SECRET, WECHAT_APP_ID, WECHAT_APP_SECRET, ADMIN_LOGIN_PHONE, ADMIN_LOGIN_PASSWORD, isProduction } from "../config/env.js";
import { query } from "../config/db.js";
import { signUserToken } from "../middleware/auth.js";

/**
 * Auth routes — mounted at /api/auth/*
 */
export const authRouter = () => {
  const app = new Hono();
  // Helper: safe constant-time comparison
  const safeCompare = (a, b) => {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return bufA.every((byte, i) => byte === bufB[i]);
  };

  app.post("/auth/wechat-login", async (c) => {
    const schema = z.object({ code: z.string().min(1) });
    const { code } = schema.parse(c.req.valid("json"));

    const appid = WECHAT_APP_ID(c.env);
    const secret = WECHAT_APP_SECRET(c.env);

    let openid;
    if (!appid || !secret) {
      console.warn("[auth] DEV: missing wechat credentials, using mock openid");
      openid = `dev-openid-${code || "default"}`;
    } else {
      const params = new URLSearchParams({
        appid,
        secret,
        js_code: code,
        grant_type: "authorization_code"
      });
      const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${params}`);
      const payload = await response.json();

      if (!response.ok || payload.errcode) {
        const msg = payload.errmsg || "微信登录失败";
        if (payload.errcode === 45011) {
          return c.json({ error: { code: "RATE_LIMITED", message: "请求过于频繁，请稍后重试" } }, 429);
        }
        return c.json({ error: { code: "WECHAT_ERROR", message: msg } }, 502);
      }

      openid = payload.openid;
    }

    const rows = await query(
      `insert into users (openid, nickname)
       values ($1, '微信用户')
       on conflict (openid) do update set updated_at = now()
       returning id, nickname, phone, points, member_level, admin_role, can_manage`,
      [openid]
    );
    const user = rows.rows[0];
    const token = await signUserToken(user, c.env);

    return c.json({ data: { token, user } });
  });

  app.post("/auth/admin-login", async (c) => {
    const schema = z.object({ phone: z.string().min(1), password: z.string().min(1) });
    const { phone, password } = schema.parse(c.req.valid("json"));

    const expectedPhone = ADMIN_LOGIN_PHONE(c.env);
    const expectedPassword = ADMIN_LOGIN_PASSWORD(c.env);

    let authenticated = false;

    if (expectedPhone && expectedPassword) {
      authenticated = safeCompare(phone, expectedPhone) && safeCompare(password, expectedPassword);
    } else {
      return c.json({ error: { code: "CONFIG_ERROR", message: "生产环境缺少 ADMIN_LOGIN_PHONE 或 ADMIN_LOGIN_PASSWORD" } }, 500);
    }

    if (!authenticated) {
      return c.json({ message: "手机号或密码错误" }, 401);
    }

    const rows = await query(
      `select id, nickname, phone, points, member_level, admin_role, can_manage
         from users
        where phone = $1
        limit 1`,
      [phone]
    );
    const user = rows.rows[0];

    if (!user?.can_manage) {
      return c.json({ message: "当前用户没有管理端权限" }, 403);
    }

    const token = await signUserToken(user, c.env);
    return c.json({ data: { token, user } });
  });

  return app;
};
