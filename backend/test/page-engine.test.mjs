// 多业态页面引擎单测（纯函数，无需数据库）
// 运行：node backend/test/page-engine.test.mjs
import { resolvePage, DEFAULT_THEME } from "../src/services/page-engine.js";

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log("  ✓", msg); }
  else { fail++; console.error("  ✗", msg); }
}
function eq(a, b, msg) {
  assert(JSON.stringify(a) === JSON.stringify(b), `${msg}  (得到 ${JSON.stringify(a)})`);
}

// ── 模板与租户 fixtures（对齐迁移种子）──
const TCM_TEMPLATE = {
  terms: { technician: "技师", booking: "预约", health_record: "健康档案", service: "服务项目", info: "健康资讯",
    nav_home: "首页", nav_book: "预约", nav_record: "档案", nav_me: "我的",
    route_1: "选服务", route_2: "选技师", route_3: "选时段", brand_tagline: "把脉问诊 · 调理身心" },
  default_sections: [
    { section_key: "service_list", kind: "service_list", titleKey: "service", payload: { source: "services" } },
    { section_key: "info_list", kind: "info_list", titleKey: "info", payload: { source: "articles" } }
  ],
  default_pages: {
    home: [
      { section_key: "service_list", kind: "service_list", titleKey: "service", payload: { source: "services" } },
      { section_key: "info_list", kind: "info_list", titleKey: "info", payload: { source: "articles" } }
    ],
    booking: [ { section_key: "service_list", kind: "service_list", titleKey: "service", payload: { source: "services" } } ],
    personal: [ { section_key: "membership", kind: "membership", title: "会员卡", payload: {}, is_active: false } ]
  },
  nav: ["nav_home", "nav_book", "nav_record", "nav_me"],
  booking_route: ["route_1", "route_2", "route_3"]
};
const GYM_TEMPLATE = {
  terms: { technician: "教练", booking: "约课", health_record: "体测报告", service: "课程", info: "健身干货",
    nav_home: "首页", nav_book: "约课", nav_record: "体测", nav_me: "我的",
    route_1: "选课程", route_2: "选教练", route_3: "选时段", brand_tagline: "科学训练 · 突破极限" },
  default_sections: [
    { section_key: "service_list", kind: "service_list", titleKey: "service", payload: { source: "courses" } },
    { section_key: "info_list", kind: "info_list", titleKey: "info", payload: { source: "articles" } },
    { section_key: "membership", kind: "membership", title: "会员卡", payload: {} }
  ],
  default_pages: {
    home: [
      { section_key: "service_list", kind: "service_list", titleKey: "service", payload: { source: "courses" } },
      { section_key: "info_list", kind: "info_list", titleKey: "info", payload: { source: "articles" } },
      { section_key: "membership", kind: "membership", title: "会员卡", payload: {} }
    ],
    booking: [
      { section_key: "service_list", kind: "service_list", titleKey: "service", payload: { source: "courses" } },
      { section_key: "membership", kind: "membership", title: "会员卡", payload: {} }
    ],
    personal: [ { section_key: "membership", kind: "membership", title: "会员卡", payload: {} } ]
  },
  nav: ["nav_home", "nav_book", "nav_record", "nav_me"],
  booking_route: ["route_1", "route_2", "route_3"]
};
const TCM_TENANT = { name: "青囊中医馆", brand_tagline: "把脉问诊 · 调理身心",
  theme_tokens: { primary: "#E76F3C", primarySoft: "#FFF0E7", accentBorder: "#FFD8C7" } };
const GYM_TENANT = { name: "动能健身", brand_tagline: "科学训练 · 突破极限",
  theme_tokens: { primary: "#0EA5A4", primarySoft: "#E6FAF8", accentBorder: "#BDEDE9" } };
// 健身房演示租户：关闭"资讯"区块（对齐迁移种子）
const GYM_CONFIGS = [
  { page_key: "home", section_key: "info_list", title: "健身干货", payload: { source: "articles" }, sort_order: 4, is_active: false }
];

console.log("页面引擎 · 双业态渲染验证");

// 1) 中医馆
const tcm = resolvePage({ tenant: TCM_TENANT, template: TCM_TEMPLATE, configs: [], pageKey: "home" });
eq(tcm.nav, ["首页", "预约", "档案", "我的"], "中医馆导航：预约/档案");
eq(tcm.bookingRoute.map((s) => s.label), ["选服务", "选技师", "选时段"], "中医馆预约路线：选服务→选技师→选时段");
eq(tcm.sections.map((s) => s.title), ["服务项目", "健康资讯"], "中医馆区块：服务项目/健康资讯");
assert(!tcm.sections.some((s) => s.kind === "membership"), "中医馆无会员卡区块");
eq(tcm.theme.primary, "#E76F3C", "中医馆主题色：橘红");
eq(tcm.terms.technician, "技师", "中医馆术语：技师");

// 2) 健身房
const gym = resolvePage({ tenant: GYM_TENANT, template: GYM_TEMPLATE, configs: GYM_CONFIGS, pageKey: "home" });
eq(gym.nav, ["首页", "约课", "体测", "我的"], "健身房导航：约课/体测");
eq(gym.bookingRoute.map((s) => s.label), ["选课程", "选教练", "选时段"], "健身房预约路线：选课程→选教练→选时段");
eq(gym.sections.map((s) => s.title), ["课程", "会员卡"], "健身房区块：课程/会员卡（资讯已关）");
assert(gym.sections.some((s) => s.kind === "membership"), "健身房含会员卡区块");
eq(gym.theme.primary, "#0EA5A4", "健身房主题色：蓝绿");
eq(gym.terms.technician, "教练", "健身房术语：教练");

// 3) 同一引擎代码路径产出两套心智（0 代码新增业态）
assert(tcm.terms.technician !== gym.terms.technician, "术语随模板切换：技师↔教练（代码零硬编码）");
assert(tcm.theme.primary !== gym.theme.primary, "主题随租户 token 切换（同一渲染组件）");

// 4) 租户术语覆盖（R3 商户微调）
const tcmOverride = resolvePage({ tenant: TCM_TENANT, template: TCM_TEMPLATE,
  tenantTerms: { service: "理疗项目" }, configs: [], pageKey: "home" });
eq(tcmOverride.sections.find((s) => s.kind === "service_list").title, "理疗项目", "租户术语覆盖：服务项目→理疗项目");

// 5) 区块开关（R4）
const tcmHideService = resolvePage({ tenant: TCM_TENANT, template: TCM_TEMPLATE,
  configs: [{ page_key: "home", section_key: "service_list", title: "服务项目", is_active: false }], pageKey: "home" });
assert(!tcmHideService.sections.some((s) => s.kind === "service_list"), "区块关闭：service_list 从 C 端消失");

// 6) 回退默认（无配置不白屏）
const tcmNoConfig = resolvePage({ tenant: TCM_TENANT, template: TCM_TEMPLATE, configs: [], pageKey: "home" });
assert(tcmNoConfig.sections.length === 2, "无配置回退模板默认区块（不白屏）");

// 7) 默认主题兜底
assert(resolvePage({ tenant: { name: "X" }, template: TCM_TEMPLATE, configs: [] }).theme.primary === DEFAULT_THEME.primary,
  "未配置主题 token 时回退默认橘红");

// 8) 多 page 区块化（R7）：不同页面使用各自的默认区块
const gymBooking = resolvePage({ tenant: GYM_TENANT, template: GYM_TEMPLATE, configs: [], pageKey: "booking" });
eq(gymBooking.sections.map((s) => s.section_key), ["service_list", "membership"], "健身房 booking 页：课程+会员卡区块");
const gymPersonal = resolvePage({ tenant: GYM_TENANT, template: GYM_TEMPLATE, configs: [], pageKey: "personal" });
assert(gymPersonal.sections.some((s) => s.kind === "membership"), "健身房 personal 页含会员卡区块");
const tcmPersonal = resolvePage({ tenant: TCM_TENANT, template: TCM_TEMPLATE, configs: [], pageKey: "personal" });
assert(!tcmPersonal.sections.some((s) => s.kind === "membership"), "中医馆 personal 页无会员卡区块（is_active=false）");
const tcmUnknown = resolvePage({ tenant: TCM_TENANT, template: TCM_TEMPLATE, configs: [], pageKey: "unknown_page" });
eq(tcmUnknown.sections.map((s) => s.section_key), ["service_list", "info_list"], "未知 page 回退 default_sections（不白屏）");

console.log(`\n结果：通过 ${pass} / 失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
