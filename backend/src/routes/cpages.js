import { Hono } from "hono";
import { z } from "zod";
import { query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin } from "../middleware/auth.js";
import { resolvePage } from "../services/page-engine.js";

export const cpagesRouter = () => {
  const app = new Hono();

  // ── 查询辅助 ──
  async function fetchResolved(tenantId, pageKey) {
    const t = await query(
      `select id, name, industry_template_key, theme_tokens, brand_tagline
         from tenants where id = $1 and status = 'active'`,
      [tenantId]
    );
    if (!t.rows[0]) return null;
    const tenant = t.rows[0];

    const tmpl = await query(`select * from industry_templates where key = $1`, [tenant.industry_template_key]);
    if (!tmpl.rows[0]) return null;
    const template = tmpl.rows[0];

    const tt = await query(`select term_key, label from tenant_terms where tenant_id = $1`, [tenantId]);
    const tenantTerms = {};
    tt.rows.forEach((r) => (tenantTerms[r.term_key] = r.label));

    const cfg = await query(
      `select page_key, section_key, title, payload, sort_order, is_active
         from tenant_page_configs where tenant_id = $1`,
      [tenantId]
    );

    return resolvePage({ tenant, template, tenantTerms, configs: cfg.rows, pageKey });
  }

  // ================= C 端（公开） =================

  // 解析租户某页面（渲染引擎，R1/R5）
  app.get("/tenants/:tenantId/pages/:pageKey", asyncHandler(async (c) => {
    const { tenantId, pageKey } = z.object({
      tenantId: z.coerce.number().int().positive(),
      pageKey: z.string().min(1).max(40)
    }).parse({ tenantId: c.req.param("tenantId"), pageKey: c.req.param("pageKey") });

    const page = await fetchResolved(tenantId, pageKey);
    if (!page) return c.json({ error: { code: "NOT_FOUND", message: "租户不存在或未启用" } }, 404);
    return c.json({ data: page });
  }));

  // 按 slug 解析（小程序 / H5 更直观，R1/R5）
  app.get("/tenants/by-slug/:slug/pages/:pageKey", asyncHandler(async (c) => {
    const { slug, pageKey } = z.object({
      slug: z.string().min(1).max(80),
      pageKey: z.string().min(1).max(40)
    }).parse({ slug: c.req.param("slug"), pageKey: c.req.param("pageKey") });

    const t = await query(
      `select id, name, industry_template_key, theme_tokens, brand_tagline
         from tenants where slug = $1 and status = 'active'`,
      [slug]
    );
    if (!t.rows[0]) return c.json({ error: { code: "NOT_FOUND", message: "租户不存在或未启用" } }, 404);
    const page = await fetchResolved(t.rows[0].id, pageKey);
    if (!page) return c.json({ error: { code: "NOT_FOUND", message: "页面解析失败" } }, 404);
    return c.json({ data: page });
  }));

  // 业态模板列表（R2）
  app.get("/templates", asyncHandler(async (c) => {
    const { rows } = await query(
      `select key, name, version, modules, terms, default_sections, nav, booking_route
         from industry_templates order by key`
    );
    return c.json({ data: rows });
  }));

  // 租户列表（管理端下拉选择，R6）
  app.get("/tenants", asyncHandler(async (c) => {
    const { rows } = await query(
      `select id, name, slug, industry_template_key, subject_type, brand_tagline, theme_tokens, status
         from tenants order by id`
    );
    return c.json({ data: rows });
  }));

  // 更新租户品牌 / 主题 token（R6：品牌名、主色、标语）
  app.patch("/admin/tenants/:id", asyncHandler(async (c) => {
    const id = z.coerce.number().int().positive().parse(c.req.param("id"));
    const body = z.object({
      name: z.string().max(100).optional(),
      brand_tagline: z.string().max(200).optional(),
      theme_tokens: z.record(z.any()).optional()
    }).parse(await c.req.json());

    const sets = [];
    const params = [];
    if (body.name !== undefined) { sets.push(`name = $${params.length + 1}`); params.push(body.name); }
    if (body.brand_tagline !== undefined) { sets.push(`brand_tagline = $${params.length + 1}`); params.push(body.brand_tagline); }
    if (body.theme_tokens !== undefined) { sets.push(`theme_tokens = $${params.length + 1}`); params.push(JSON.stringify(body.theme_tokens)); }
    if (sets.length === 0) return c.json({ data: { id } });
    sets.push(`updated_at = now()`);
    params.push(id);
    const { rows } = await query(
      `update tenants set ${sets.join(", ")} where id = $${params.length} returning id, name, slug, industry_template_key, subject_type, brand_tagline, theme_tokens, status`,
      params
    );
    if (!rows[0]) return c.json({ error: { code: "NOT_FOUND", message: "租户不存在" } }, 404);
    return c.json({ data: rows[0] });
  }));

  // 套餐列表（Phase 3）
  app.get("/admin/plans", asyncHandler(async (c) => {
    const { rows } = await query(`select key, name, description, menus, capabilities, sort_order from plans order by sort_order, key`);
    return c.json({ data: rows });
  }));

  // 租户当前套餐 + 可用菜单（Phase 3 门控）
  app.get("/admin/tenants/:id/plan", asyncHandler(async (c) => {
    const id = z.coerce.number().int().positive().parse(c.req.param("id"));
    const { rows } = await query(
      `select p.key, p.name, p.menus, p.capabilities
         from tenant_plans tp join plans p on p.key = tp.plan_key
        where tp.tenant_id = $1 and (tp.ended_at is null or tp.ended_at > now())
        order by tp.started_at desc limit 1`,
      [id]
    );
    if (!rows[0]) {
      const basic = await query(`select key, name, menus, capabilities from plans where key = 'basic' limit 1`);
      return c.json({ data: { ...basic.rows[0], default: true } });
    }
    return c.json({ data: rows[0] });
  }));

  // 设置租户套餐（Phase 3）
  app.put("/admin/tenants/:id/plan", asyncHandler(async (c) => {
    const id = z.coerce.number().int().positive().parse(c.req.param("id"));
    const body = z.object({ planKey: z.string().min(1).max(40) }).parse(await c.req.json());
    const exists = await query(`select 1 from plans where key = $1`, [body.planKey]);
    if (!exists.rows[0]) return c.json({ error: { code: "PLAN_NOT_FOUND", message: "套餐不存在" } }, 404);
    await query(`update tenant_plans set ended_at = now() where tenant_id = $1 and ended_at is null`, [id]);
    const { rows } = await query(
      `insert into tenant_plans (tenant_id, plan_key) values ($1,$2) returning *`,
      [id, body.planKey]
    );
    return c.json({ data: rows[0] }, 201);
  }));

  // 某模板的术语字典（R3）
  app.get("/templates/:key/terms", asyncHandler(async (c) => {
    const key = z.string().min(1).max(60).parse(c.req.param("key"));
    const { rows } = await query(`select terms from industry_templates where key = $1`, [key]);
    if (!rows[0]) return c.json({ error: { code: "NOT_FOUND", message: "模板不存在" } }, 404);
    return c.json({ data: rows[0].terms });
  }));

  // ================= 管理端（需权限，R6） =================
  app.use("/admin/*", requireAdmin);

  // 租户来源：优先请求上下文（x-tenant-id），其次显式参数（开发回退）
  function ctxTenantId(c) {
    const ctx = c.get("tenantId");
    if (ctx) return ctx;
    const q = c.req.query("tenantId");
    if (q && /^\d+$/.test(q)) return Number(q);
    return null;
  }

  // 列出某租户区块配置
  app.get("/admin/configs", asyncHandler(async (c) => {
    const tenantId = ctxTenantId(c);
    if (!tenantId) return c.json({ error: { code: "TENANT_REQUIRED", message: "缺少租户上下文" } }, 400);
    const pageKey = z.string().max(40).optional().parse(c.req.query("pageKey"));
    const params = [tenantId];
    let sql = `select id, tenant_id, page_key, section_key, title, payload, sort_order, is_active
                 from tenant_page_configs where tenant_id = $1`;
    if (pageKey) {
      sql += ` and page_key = $2`;
      params.push(pageKey);
    }
    sql += ` order by page_key, sort_order, id`;
    const { rows } = await query(sql, params);
    return c.json({ data: rows });
  }));

  // 新增 / 覆盖区块配置（upsert by tenant+page+section），强制写入上下文租户
  app.post("/admin/configs", asyncHandler(async (c) => {
    const body = z.object({
      tenantId: z.number().int().positive().optional(),
      pageKey: z.string().min(1).max(40).default("home"),
      sectionKey: z.string().min(1).max(60),
      title: z.string().max(120).optional(),
      payload: z.record(z.any()).default({}),
      sortOrder: z.number().int().default(0),
      isActive: z.boolean().default(true)
    }).parse(await c.req.json());

    const tenantId = ctxTenantId(c) ?? body.tenantId;
    if (!tenantId) return c.json({ error: { code: "TENANT_REQUIRED", message: "缺少租户上下文" } }, 400);

    const { rows } = await query(
      `insert into tenant_page_configs (tenant_id, page_key, section_key, title, payload, sort_order, is_active)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (tenant_id, page_key, section_key)
       do update set title = excluded.title, payload = excluded.payload,
                     sort_order = excluded.sort_order, is_active = excluded.is_active,
                     updated_at = now()
       returning id, tenant_id, page_key, section_key, title, payload, sort_order, is_active`,
      [tenantId, body.pageKey, body.sectionKey, body.title ?? null,
       JSON.stringify(body.payload), body.sortOrder, body.isActive]
    );
    return c.json({ data: rows[0] }, 201);
  }));

  // 更新区块配置（校验归属当前租户，防跨租户改写）
  app.put("/admin/configs/:id", asyncHandler(async (c) => {
    const id = z.coerce.number().int().positive().parse(c.req.param("id"));
    const tenantId = ctxTenantId(c);
    if (tenantId) {
      const owner = await query(`select 1 from tenant_page_configs where id = $1 and tenant_id = $2`, [id, tenantId]);
      if (!owner.rows[0]) return c.json({ error: { code: "FORBIDDEN", message: "无权操作该租户配置" } }, 403);
    }
    const body = z.object({
      title: z.string().max(120).optional(),
      payload: z.record(z.any()).optional(),
      sortOrder: z.number().int().optional(),
      isActive: z.boolean().optional()
    }).parse(await c.req.json());

    const sets = [];
    const params = [];
    if (body.title !== undefined) { sets.push(`title = $${params.length + 1}`); params.push(body.title); }
    if (body.payload !== undefined) { sets.push(`payload = $${params.length + 1}`); params.push(JSON.stringify(body.payload)); }
    if (body.sortOrder !== undefined) { sets.push(`sort_order = $${params.length + 1}`); params.push(body.sortOrder); }
    if (body.isActive !== undefined) { sets.push(`is_active = $${params.length + 1}`); params.push(body.isActive); }
    if (sets.length === 0) return c.json({ data: { id } });
    sets.push(`updated_at = now()`);
    params.push(id);
    const { rows } = await query(
      `update tenant_page_configs set ${sets.join(", ")} where id = $${params.length} returning *`,
      params
    );
    if (!rows[0]) return c.json({ error: { code: "NOT_FOUND", message: "配置不存在" } }, 404);
    return c.json({ data: rows[0] });
  }));

  // 删除区块配置（校验归属当前租户）
  app.delete("/admin/configs/:id", asyncHandler(async (c) => {
    const id = z.coerce.number().int().positive().parse(c.req.param("id"));
    const tenantId = ctxTenantId(c);
    if (tenantId) {
      const owner = await query(`select 1 from tenant_page_configs where id = $1 and tenant_id = $2`, [id, tenantId]);
      if (!owner.rows[0]) return c.json({ error: { code: "FORBIDDEN", message: "无权操作该租户配置" } }, 403);
    }
    const { rowCount } = await query(`delete from tenant_page_configs where id = $1`, [id]);
    if (rowCount === 0) return c.json({ error: { code: "NOT_FOUND", message: "配置不存在" } }, 404);
    return c.json({ data: { id, deleted: true } });
  }));

  return app;
};
