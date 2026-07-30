import { Hono } from "hono";
import { z } from "zod";
import { JWT_SECRET, WECHAT_APP_ID, WECHAT_APP_SECRET, ADMIN_LOGIN_PHONE, ADMIN_LOGIN_PASSWORD, isProduction } from "../config/env.js";
import { query } from "../config/db.js";
import { signUserToken, attachCurrentUser } from "../middleware/auth.js";

export const authRouter = () => {
  const app = new Hono();
  const safeCompare = (a, b) => {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return bufA.every((byte, i) => byte === bufB[i]);
  };

  app.post("/auth/wechat-login", async (c) => {
    const schema = z.object({ code: z.string().min(1) });
    const { code } = schema.parse(await c.req.json());

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
    const { phone, password } = schema.parse(await c.req.json());

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

  /**
   * Bind phone number to current user.
   * Requires JWT auth. Accepts the `code` from WeChat's getPhoneNumber button,
   * exchanges it with WeChat to get the phone number, then stores it on the user.
   */
  app.post("/auth/bind-phone", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ message: "请先登录" }, 401);
    }

    const schema = z.object({ code: z.string().min(1) });
    const { code } = schema.parse(await c.req.json());

    const appid = WECHAT_APP_ID(c.env);
    const secret = WECHAT_APP_SECRET(c.env);

    let phone = "";

    if (!appid || !secret) {
      console.warn("[auth] DEV: bind-phone in dev mode, skipping phone fetch");
      phone = "";
    } else {
      // Step 1: Get access_token via client_credential
      const tokenParams = new URLSearchParams({
        grant_type: "client_credential",
        appid,
        secret
      });
      const tokenRes = await fetch(`https://api.weixin.qq.com/cgi-bin/token?${tokenParams}`);
      const tokenPayload = await tokenRes.json();
      if (!tokenRes.ok || tokenPayload.errcode || !tokenPayload.access_token) {
        return c.json({ error: { code: "WECHAT_ERROR", message: tokenPayload.errmsg || "获取 access_token 失败" } }, 502);
      }
      const accessToken = tokenPayload.access_token;

      // Step 2: Use getPhoneNumber API to decrypt the phone
      const phoneRes = await fetch(`https://api.weixin.qq.com/cgi-bin/secure/getPhoneNumber?access_token=${accessToken}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code })
      });
      const phonePayload = await phoneRes.json();

      if (!phoneRes.ok || phonePayload.errcode) {
        return c.json({ error: { code: "WECHAT_ERROR", message: phonePayload.errmsg || "获取手机号失败" } }, 502);
      }

      const rawPhone = phonePayload.phone_info?.purePhoneNumber || "";
      if (!rawPhone) {
        return c.json({ error: { code: "PHONE_EMPTY", message: "未能获取到手机号，请重试" } }, 400);
      }
      phone = String(rawPhone);
    }

    const updated = await query(
      `update users set phone = $1, updated_at = now()
       where id = $2
       returning id, nickname, phone, points, member_level, admin_role, can_manage`,
      [phone || null, user.id]
    );

    const updatedUser = updated.rows[0];
    const token = await signUserToken(updatedUser, c.env);

    return c.json({ data: { token, user: updatedUser } });
  });

  return app;
};
