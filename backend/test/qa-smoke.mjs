// ============================================================
// QA 全流程冒烟测试（连真实 Neon 库，写操作用后即清理）
// 运行: DATABASE_URL=... node test/qa-smoke.mjs
// ============================================================
import { createApp } from "../src/app.js";
import { SignJWT } from "jose";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

function loadEnvFile() {
  if (process.env.DATABASE_URL) return;
  try {
    const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
    }
  } catch { /* .env 不存在时忽略 */ }
}
loadEnvFile();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("需要 DATABASE_URL 环境变量");
  process.exit(1);
}

const env = {
  DATABASE_URL,
  JWT_SECRET: "qa-smoke-secret",
  JWT_EXPIRES_IN: "10m",
  ADMIN_LOGIN_PHONE: "13800000000",
  ADMIN_LOGIN_PASSWORD: "admin123",
  CORS_ORIGIN: "*"
};

const app = createApp(env);
const db = neon(DATABASE_URL);

const results = [];
let pass = 0, fail = 0;
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (ok) pass++; else fail++;
  console.log(`${ok ? "✓" : "✗ FAIL"} ${name}${detail ? "  — " + detail : ""}`);
}
const req = (path, opts = {}) =>
  app.request(path, {
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    ...opts
  }, env); // Hono 第三参为 Env（模拟 Workers c.env）

async function main() {
  // 1. 健康检查
  let res = await req("/health");
  record("GET /health → 200", res.status === 200, `status=${res.status}`);

  // 2. 未登录访问管理接口
  res = await req("/api/admin/users");
  record("未登录 GET /api/admin/users → 401", res.status === 401, `status=${res.status}`);

  // 3. 错误密码登录
  res = await req("/api/auth/admin-login", { method: "POST", body: JSON.stringify({ phone: "13800000000", password: "wrong" }) });
  record("错误密码 admin-login → 401", res.status === 401, `status=${res.status}`);

  // 4. 正确登录拿 owner token
  res = await req("/api/auth/admin-login", { method: "POST", body: JSON.stringify({ phone: "13800000000", password: "admin123" }) });
  const loginOk = res.status === 200;
  const loginBody = loginOk ? await res.json() : null;
  record("正确 admin-login → 200 + token", loginOk && !!loginBody?.data?.token, `status=${res.status}`);
  const adminToken = loginBody?.data?.token;
  const adminAuth = { authorization: `Bearer ${adminToken}` };
  record("登录用户为 owner", loginBody?.data?.user?.admin_role === "owner", `role=${loginBody?.data?.user?.admin_role}`);

  // 5. owner 拉用户列表
  res = await req("/api/admin/users", { headers: adminAuth });
  let body = await res.json().catch(() => null);
  record("owner GET /api/admin/users → 200 列表", res.status === 200 && Array.isArray(body?.data), `status=${res.status} count=${body?.data?.length}`);

  // 6. 套餐列表
  res = await req("/api/cpages/admin/plans", { headers: adminAuth });
  body = await res.json().catch(() => null);
  const planKeys = JSON.stringify(body?.data || body || []);
  record("GET /api/admin/plans → 200 含三档套餐", res.status === 200 && planKeys.includes("basic") && planKeys.includes("pro") && planKeys.includes("flagship"), `status=${res.status}`);

  // 7. 租户套餐（cpages）
  res = await req("/api/cpages/admin/tenants/1/plan", { headers: adminAuth });
  record("owner GET /api/admin/tenants/1/plan → 200", res.status === 200, `status=${res.status}`);

  // 7b. 重复切换套餐回归（历史 bug：切回用过的套餐撞 unique(tenant_id, plan_key)）
  res = await req("/api/cpages/admin/tenants/1/plan", { method: "PUT", headers: adminAuth, body: JSON.stringify({ planKey: "pro" }) });
  record("owner PUT plan → pro 201", res.status === 201, `status=${res.status}`);
  res = await req("/api/cpages/admin/tenants/1/plan", { method: "PUT", headers: adminAuth, body: JSON.stringify({ planKey: "flagship" }) });
  record("owner PUT plan 切回旗舰版 → 201 (upsert 无 duplicate key)", res.status === 201, `status=${res.status}`);
  const planAfter = await db.query("select plan_key from tenant_plans where tenant_id = 1 and ended_at is null");
  record("切换后租户1生效套餐 = flagship", planAfter[0]?.plan_key === "flagship", JSON.stringify(planAfter));

  // 8. 伪造普通用户 token（DB 中 can_manage=false 用户）
  const normal = await db.query("select id, nickname from users where (can_manage = false or can_manage is null) order by id limit 1");
  let normalAuth = null;
  if (normal[0]) {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const t = await new SignJWT({ sub: String(normal[0].id) }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(secret);
    normalAuth = { authorization: `Bearer ${t}` };
  }
  if (normalAuth) {
    res = await req("/api/admin/users", { headers: normalAuth });
    record("普通用户 GET /api/admin/users → 403", res.status === 403, `status=${res.status}`);

    // 9. cpages 鉴权缺口回归：普通用户改租户品牌
    res = await req("/api/admin/tenants/1", { method: "PATCH", headers: normalAuth, body: JSON.stringify({ name: "被越权改名" }) });
    record("普通用户 PATCH /api/admin/tenants/1 → 403 (鉴权缺口已修复)", res.status === 403, `status=${res.status}`);

    // 10. 普通用户改租户套餐
    res = await req("/api/cpages/admin/tenants/1/plan", { method: "PUT", headers: normalAuth, body: JSON.stringify({ planKey: "flagship" }) });
    record("普通用户 PUT /api/admin/tenants/1/plan → 403", res.status === 403, `status=${res.status}`);
  } else {
    record("普通用户越权场景", false, "DB 中无可用的普通用户");
  }

  // 11. owner 创建用户 + 重复手机号 409 + 清理
  const testPhone = "13900001111";
  await db.query("delete from users where phone = $1", [testPhone]); // 幂等清理残留
  res = await req("/api/admin/users", { method: "POST", headers: adminAuth, body: JSON.stringify({ phone: testPhone, nickname: "QA冒烟测试用户" }) });
  body = await res.json().catch(() => null);
  record("owner POST /api/admin/users → 201", res.status === 201, `status=${res.status} id=${body?.data?.id}`);
  const createdId = body?.data?.id;
  res = await req("/api/admin/users", { method: "POST", headers: adminAuth, body: JSON.stringify({ phone: testPhone, nickname: "重复" }) });
  record("重复手机号 POST /api/admin/users → 409", res.status === 409, `status=${res.status}`);

  // 12. 设 tenant_admin 缺 tenantId → 400
  if (createdId) {
    res = await req(`/api/admin/users/${createdId}/role`, { method: "PATCH", headers: adminAuth, body: JSON.stringify({ adminRole: "tenant_admin", canManage: true }) });
    record("tenant_admin 缺 tenantId → 400", res.status === 400, `status=${res.status}`);
    // 清理
    res = await req(`/api/admin/users/${createdId}`, { method: "DELETE", headers: adminAuth });
    record("清理测试用户 DELETE → 2xx", res.status >= 200 && res.status < 300, `status=${res.status}`);
    await db.query("delete from users where phone = $1", [testPhone]);
  }

  // 13. 商户交易（payments 挂载于 /api/payments）
  res = await req("/api/payments/admin/merchant/transactions", { headers: adminAuth });
  record("owner GET /api/payments/admin/merchant/transactions → 200", res.status === 200, `status=${res.status}`);

  // 13b. 商户管理：列表 + 新建 + slug 冲突 + 清理
  res = await req("/api/cpages/admin/tenants", { headers: adminAuth });
  body = await res.json().catch(() => null);
  record("owner GET /api/cpages/admin/tenants → 200 列表", res.status === 200 && Array.isArray(body?.data), `status=${res.status} count=${body?.data?.length}`);
  const testSlug = "qa-smoke-tenant";
  await db.query("delete from tenants where slug = $1", [testSlug]); // 幂等清理
  res = await req("/api/cpages/admin/tenants", { method: "POST", headers: adminAuth, body: JSON.stringify({ name: "QA冒烟商户", slug: testSlug, industryTemplateKey: "tcm_clinic" }) });
  body = await res.json().catch(() => null);
  record("owner POST /api/cpages/admin/tenants → 201", res.status === 201, `status=${res.status} id=${body?.data?.id}`);
  if (body?.data?.id) {
    // 验证自动初始化：术语字典 + 基础套餐
    const terms = await db.query("select count(*)::int as n from tenant_terms where tenant_id = $1", [body.data.id]);
    const plan = await db.query("select plan_key from tenant_plans where tenant_id = $1", [body.data.id]);
    record("新建商户自动初始化术语+基础套餐", terms[0].n > 0 && plan[0]?.plan_key === "basic", `terms=${terms[0].n} plan=${plan[0]?.plan_key || "none"}`);
  }
  res = await req("/api/cpages/admin/tenants", { method: "POST", headers: adminAuth, body: JSON.stringify({ name: "重复", slug: testSlug, industryTemplateKey: "tcm_clinic" }) });
  record("重复 slug POST → 409", res.status === 409, `status=${res.status}`);
  await db.query("delete from tenants where slug = $1", [testSlug]); // cascade 清理
  record("清理测试商户", true, "slug=qa-smoke-tenant 已删除");

  // 13c. 普通用户不能新建商户
  if (normalAuth) {
    res = await req("/api/cpages/admin/tenants", { method: "POST", headers: normalAuth, body: JSON.stringify({ name: "越权", slug: "qa-no-perm", industryTemplateKey: "gym" }) });
    record("普通用户 POST /admin/tenants → 403", res.status === 403, `status=${res.status}`);
  }

  // 14. 退款接口未带订单 → 期望 4xx（非 500）
  res = await req("/api/payments/refunds", { method: "POST", headers: adminAuth, body: JSON.stringify({ outTradeNo: "QA_NOT_EXIST_0001", amount: 1 }) });
  record("POST /api/payments/refunds 不存在订单 → 4xx(非500)", res.status >= 400 && res.status < 500, `status=${res.status}`);

  console.log(`\n========== 冒烟测试汇总: 通过 ${pass} / 失败 ${fail} ==========`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error("冒烟脚本异常:", e); process.exit(1); });
