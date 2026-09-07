// ============================================================
// 套餐 / 能力包门控（R13，Phase 3）—— 纯函数，零外部依赖，可单测
// 原则（ADR-5）：套餐仅定义「可用菜单 + 可用能力」集合，不接入计费 / 用量。
// 管理端与 C 端据此隐藏无权限的菜单 / 模块。
// ============================================================

// 全量菜单清单（与 admin-shared navItems 的 key 对齐）
export const ALL_MENUS = [
  "dashboard", "stores", "services", "practitioners", "schedules",
  "technicianPortal", "orders", "commissions", "homepage", "pageConfig",
  "content", "users", "reviews", "audit", "transactions", "plans",
];

// 全量能力标识
export const ALL_CAPABILITIES = [
  "booking", "single_store", "multi_store", "marketing",
  "data_board", "pay", "technician_portal", "content_ops",
];

// 套餐定义（与 DB plans 表种子一致；运行时以 DB 为准，此表作离线默认与单测基准）
export const DEFAULT_PLANS = {
  basic: {
    key: "basic", name: "基础版",
    menus: ["dashboard", "stores", "services", "orders", "users", "pageConfig"],
    capabilities: ["booking", "single_store"],
  },
  pro: {
    key: "pro", name: "专业版",
    menus: ["dashboard", "stores", "services", "practitioners", "schedules", "orders", "commissions", "pageConfig", "content", "users", "reviews", "audit"],
    capabilities: ["booking", "multi_store", "marketing", "data_board", "pay"],
  },
  flagship: {
    key: "flagship", name: "旗舰版",
    menus: ["dashboard", "stores", "services", "practitioners", "schedules", "technicianPortal", "orders", "commissions", "homepage", "pageConfig", "content", "users", "reviews", "audit"],
    capabilities: ["booking", "multi_store", "marketing", "data_board", "pay", "technician_portal", "content_ops"],
  },
};

/**
 * 解析某套餐的可用菜单 / 能力集合。
 * @param {string} planKey 套餐 key
 * @param {object} [planDefs] 自定义套餐定义（覆盖 DEFAULT_PLANS）
 * @returns {{menus:Set<string>, capabilities:Set<string>, planKey:string, name:string}}
 */
export function resolveEntitlements(planKey, planDefs = DEFAULT_PLANS) {
  const def = planDefs[planKey] || planDefs.basic;
  return {
    planKey: def.key,
    name: def.name,
    menus: new Set(def.menus || []),
    capabilities: new Set(def.capabilities || []),
  };
}

// 菜单是否对当前套餐可见
export function isMenuAllowed(planKey, menuKey, planDefs = DEFAULT_PLANS) {
  return resolveEntitlements(planKey, planDefs).menus.has(menuKey);
}

// 能力是否开放
export function hasCapability(planKey, capability, planDefs = DEFAULT_PLANS) {
  return resolveEntitlements(planKey, planDefs).capabilities.has(capability);
}

/**
 * 按套餐过滤导航项（Phase 2 管理端模板化复用）。
 * @param {Array<{key:string,path:string,label:string}>} navItems
 * @param {string} planKey
 * @param {object} [planDefs]
 * @returns {Array} 仅含套餐允许可见的菜单
 */
export function filterNavByPlan(navItems, planKey, planDefs = DEFAULT_PLANS) {
  const ent = resolveEntitlements(planKey, planDefs);
  return (navItems || []).filter((it) => ent.menus.has(it.key));
}
