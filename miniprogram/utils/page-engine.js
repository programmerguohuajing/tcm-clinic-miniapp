// 多业态页面引擎客户端加载器（Phase 1 P1）：按 slug + pageKey 取区块渲染模型
// 返回 { brand, tagline, theme, terms, nav, bookingRoute, sections }
const { request } = require("./request");
const { isDev } = require("./env");
const mock = require("./mock-data");

function tenantSlug() {
  return (getApp().globalData && getApp().globalData.tenantSlug) || "qingnang";
}

// 加载某页面引擎解析结果（失败降级到本地 mock 术语，不白屏）
async function loadPage(pageKey = "home") {
  const slug = tenantSlug();
  try {
    const page = await request(`/cpages/tenants/by-slug/${slug}/pages/${pageKey}`);
    if (page && page.brand) return page;
    return fallbackPage(pageKey);
  } catch (e) {
    if (isDev()) return fallbackPage(pageKey);
    throw e;
  }
}

// 按区块声明的数据源并行取数（复用 home 的 SOURCE_API 思路）
const SOURCE_API = {
  services: "/services",
  courses: "/services?category=gym_course",
  articles: "/articles",
  activities: "/activities",
  membership: "/membership-cards",
  coaches: "/practitioners"
};

function buildSourceUrl(base, storeId, slug) {
  const [path, existing] = base.split("?");
  const params = existing ? [existing] : [];
  if (storeId) params.push(`storeId=${storeId}`);
  if (path.startsWith("/membership")) params.push(`tenantSlug=${slug}`);
  return params.length ? `${path}?${params.join("&")}` : path;
}

async function loadSectionsWithData(page, storeId) {
  const slug = tenantSlug();
  const sourceMap = {};
  const needed = new Set((page.sections || []).map((s) => s.payload && s.payload.source).filter(Boolean));
  const fetches = [];
  for (const src of needed) {
    const base = SOURCE_API[src];
    if (base && !sourceMap[src]) {
      sourceMap[src] = [];
      const url = buildSourceUrl(base, storeId, slug);
      fetches.push(
        request(url).then((list) => { sourceMap[src] = Array.isArray(list) ? list : []; }).catch(() => { sourceMap[src] = []; })
      );
    }
  }
  await Promise.all(fetches);
  return (page.sections || []).map((s) => ({ ...s, items: s.payload && s.payload.source ? (sourceMap[s.payload.source] || []) : [] }));
}

function fallbackPage(pageKey) {
  const terms = mock.terms || {};
  const sections = pageKey === "booking"
    ? [{ section_key: "service_list", kind: "service_list", title: terms.service || "服务项目", payload: { source: "services" }, items: mock.services || [] }]
    : pageKey === "profile"
      ? [{ section_key: "member_card", kind: "member_card", title: terms.member || "会员", payload: {}, items: [] }]
      : [
          { section_key: "service_list", kind: "service_list", title: terms.service || "服务项目", payload: { source: "services" }, items: mock.services || [] },
          { section_key: "info_list", kind: "info_list", title: terms.info || "", payload: { source: "articles" }, items: mock.articles || [] }
        ];
  return {
    brand: mock.brand || "演示门店",
    tagline: terms.brand_tagline || "",
    theme: { primary: "#E76F3C", bg: "#F4F5F6", surface: "#FFFFFF", title: "#17191C", text: "#2D3035", muted: "#73777D", border: "#DEE1E4" },
    terms,
    nav: [terms.nav_home, terms.nav_book, terms.nav_record, terms.nav_me].filter(Boolean),
    bookingRoute: [terms.route_1, terms.route_2, terms.route_3].filter(Boolean).map((label, i) => ({ step: String(i + 1).padStart(2, "0"), label })),
    sections
  };
}

module.exports = { loadPage, loadSectionsWithData, SOURCE_API, fallbackPage, tenantSlug };
