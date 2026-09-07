// 多业态页面引擎核心（纯函数，零外部依赖，便于无数据库单元测试）
// 入参均使用普通对象，DB 查询层（routes/cpages.js）负责取数后调用本模块。

export const DEFAULT_THEME = {
  primary: "#E76F3C",
  primarySoft: "#FFF0E7",
  accentBorder: "#FFD8C7",
  bg: "#F4F5F6",
  surface: "#FFFFFF",
  title: "#17191C",
  text: "#2D3035",
  muted: "#73777D",
  border: "#DEE1E4"
};

// 将模板默认区块与租户配置合并为一个区块定义
function applyOverride(def, ov, terms) {
  const title =
    ov && ov.title != null && ov.title !== ""
      ? ov.title
      : def.titleKey
        ? terms[def.titleKey]
        : def.title;
  return {
    section_key: def.section_key,
    kind: def.kind || def.section_key,
    title,
    payload: ov ? { ...(def.payload || {}), ...(ov.payload || {}) } : def.payload || {},
    sort_order: ov?.sort_order ?? def.sort_order ?? 0,
    is_active: (def.is_active !== false) && (ov ? ov.is_active !== false : true)
  };
}

/**
 * 解析租户某页面的可渲染模型。
 * @param {object} params
 * @param {object} params.tenant   - { name, brand_tagline, theme_tokens }
 * @param {object} params.template - { terms, default_sections, nav, booking_route }
 * @param {object} [params.tenantTerms] - 租户级术语覆盖 { term_key: label }
 * @param {Array}  [params.configs] - 租户区块配置 [{ page_key, section_key, title, payload, sort_order, is_active }]
 * @param {string} [params.pageKey] - 目标页面 key，默认 home
 */
export function resolvePage({ tenant, template, tenantTerms = {}, configs = [], pageKey = "home" }) {
  if (!tenant || !template) throw new Error("[page-engine] tenant 与 template 均为必填");

  const terms = { ...(template.terms || {}), ...tenantTerms };
  const theme = { ...DEFAULT_THEME, ...(tenant.theme_tokens || {}) };

  // R7 多 page：优先读取模板按 page 组织的默认区块，回退到单维 default_sections（兼容仅首页模板）
  const defs =
    (template.default_pages && Array.isArray(template.default_pages[pageKey]) && template.default_pages[pageKey].length)
      ? template.default_pages[pageKey]
      : (template.default_sections || []);
  const defKeys = new Set(defs.map((d) => d.section_key));
  const byKey = {};
  for (const c of configs) {
    if (c.page_key === pageKey) byKey[c.section_key] = c;
  }

  // 模板默认区块 + 租户覆盖（无配置即回退默认，不白屏、不报错）
  let sections = defs.map((def) => applyOverride(def, byKey[def.section_key], terms));
  // 租户独有区块（模板未定义，按 R5 优雅跳过未知 section 由渲染端决定）
  for (const c of configs) {
    if (c.page_key === pageKey && !defKeys.has(c.section_key)) {
      sections.push(applyOverride({ section_key: c.section_key, kind: c.section_key, payload: {} }, c, terms));
    }
  }
  sections = sections
    .filter((s) => s.is_active)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const nav = (template.nav || []).map((k) => terms[k]).filter(Boolean);
  const bookingRoute = (template.booking_route || [])
    .map((k) => terms[k])
    .filter(Boolean)
    .map((label, i) => ({ step: String(i + 1).padStart(2, "0"), label }));

  return {
    brand: tenant.name,
    tagline: tenant.brand_tagline || terms.brand_tagline || "",
    theme,
    terms,
    nav,
    bookingRoute,
    sections
  };
}
