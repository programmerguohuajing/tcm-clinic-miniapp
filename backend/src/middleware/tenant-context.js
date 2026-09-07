// Phase 0 — 多租户请求上下文
// 解析当前请求的租户标识，写入 c.set("tenantId")，供后续路由做行级隔离。
//
// 解析优先级（生产可在此扩展）：
//   1. x-tenant-id   显式租户 ID（开发 / 管理端调试最常用）
//   2. x-tenant-slug 租户 slug
//   3. 子域名        gym.example.com → slug=gym（生产推荐，预留 hook）
//   注：真实微信登录后，tenant 也可由 JWT 的 tenant claim 注入（见 requireTenant）。
import { query } from "../config/db.js";

// 从请求解析租户标识：返回 number(id) | { slug } | null
export function resolveTenantId(c) {
  const idHeader = c.req.header("x-tenant-id");
  if (idHeader && /^\d+$/.test(idHeader.trim())) {
    return Number(idHeader.trim());
  }
  const slug = c.req.header("x-tenant-slug");
  if (slug && slug.trim()) {
    return { slug: slug.trim() };
  }
  // 子域名解析（生产）：从 host 提取一级子域作为 slug
  const host = c.req.header("host") || "";
  const m = host.match(/^([a-z0-9-]+)\.(?:[a-z0-9-]+\.)+[a-z]{2,}$/i);
  if (m && m[1] && m[1] !== "www" && m[1] !== "api") {
    return { slug: m[1] };
  }
  return null;
}

// 中间件：填充 c.set("tenantId") / c.set("tenant")
export async function tenantContext(c, next) {
  const resolved = resolveTenantId(c);
  if (resolved == null) {
    c.set("tenantId", null);
    c.set("tenant", null);
    return next();
  }
  if (typeof resolved === "number") {
    c.set("tenantId", resolved);
  } else {
    const { rows } = await query(
      `select id, slug, name, industry_template_key, subject_type, theme_tokens, brand_tagline, status
         from tenants where slug = $1 limit 1`,
      [resolved.slug]
    );
    c.set("tenantId", rows[0]?.id ?? null);
    c.set("tenant", rows[0] ?? null);
  }
  return next();
}

// 守卫：要求请求带租户上下文（租户级写操作使用）
export function requireTenant(c, next) {
  if (!c.get("tenantId")) {
    return c.json({ error: { code: "TENANT_REQUIRED", message: "缺少租户上下文（请携带 x-tenant-id 或 x-tenant-slug）" } }, 400);
  }
  return next();
}

// 类比 storeFilter：返回带 tenant_id 过滤的 sql 片段。
// 调用方需将已有参数平铺，并把 startIndex 设为「已有参数个数 + 1」。
//   const f = tenantFilter(tenantId, "a.", existingParams.length + 1);
//   await query(`select ... from t a where 1=1 ${f.sql}`, [...existingParams, ...f.params]);
export function tenantFilter(tenantId, alias = "", startIndex = 1) {
  if (!tenantId) return { sql: "", params: [] };
  return {
    sql: ` and ${alias}tenant_id = $${startIndex}`,
    params: [tenantId],
  };
}
