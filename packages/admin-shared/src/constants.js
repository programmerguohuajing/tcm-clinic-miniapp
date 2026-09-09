// 全量导航项（key 与后端 entitlement.ALL_MENUS 对齐；标签走术语字典，不写死业务词）
export const navItems = [
  { path: "/", key: "dashboard", label: "经营看板" },
  { path: "/tenants", key: "tenants", label: "商户管理" },
  { path: "/stores", key: "stores", label: "多门店" },
  { path: "/services", key: "services", label: "服务项目" },
  { path: "/practitioners", key: "practitioners", label: "技师管理" },
  { path: "/schedules", key: "schedules", label: "技师排班" },
  { path: "/technician-portal", key: "technicianPortal", label: "技师工作台" },
  { path: "/orders", key: "orders", label: "预约订单" },
  { path: "/commissions", key: "commissions", label: "提成结算" },
  { path: "/homepage", key: "homepage", label: "首页配置" },
  { path: "/page-config", key: "pageConfig", label: "页面配置" },
  { path: "/content", key: "content", label: "内容营销" },
  { path: "/users", key: "users", label: "会员权限" },
  { path: "/reviews", key: "reviews", label: "评价管理" },
  { path: "/audit", key: "audit", label: "操作日志" },
  { path: "/transactions", key: "transactions", label: "商户交易" },
  { path: "/plans", key: "plans", label: "套餐管理" }
];

// 业态模板 → 默认可见导航（Phase 2 管理端模板化）
// 中医馆看不到团课/会员卡专属项（此处用统一 navItems，具体业态差异由套餐能力再过滤）
export const navByTemplate = {
  tcm_clinic: ["dashboard", "tenants", "stores", "services", "practitioners", "schedules", "orders", "commissions", "homepage", "pageConfig", "content", "users", "reviews", "audit", "transactions", "plans"],
  gym: ["dashboard", "tenants", "stores", "services", "practitioners", "schedules", "orders", "commissions", "pageConfig", "content", "users", "reviews", "audit", "transactions", "plans"],
};

// 默认套餐（无套餐时回退基础版）
export const DEFAULT_PLAN = "basic";

// 按套餐 + 业态过滤导航（Phase 2 + Phase 3：模板决定基调，套餐决定能力门控）
// planMenus: 后端返回的该套餐允许菜单 key 数组
// templateKey: 业态模板 key（缺省全量）
export function resolveNavItems({ planMenus, templateKey } = {}) {
  let base = navItems;
  if (templateKey && Array.isArray(navByTemplate[templateKey])) {
    const allowed = new Set(navByTemplate[templateKey]);
    base = navItems.filter((it) => allowed.has(it.key));
  }
  if (Array.isArray(planMenus) && planMenus.length) {
    const allowed = new Set(planMenus);
    return base.filter((it) => allowed.has(it.key));
  }
  return base;
}

export const statusMap = {
  active: "启用",
  inactive: "停用",
  resting: "休息",
  open: "开放",
  closed: "关闭",
  pending: "待确认",
  confirmed: "已确认",
  completed: "已完成",
  cancelled: "已取消",
  refunded: "已退款",
  published: "已发布",
  draft: "草稿",
  visible: "显示",
  hidden: "隐藏",
  true: "是",
  false: "否"
};

export const offStatuses = ["inactive", "closed", "cancelled", "refunded", "hidden", "draft", false];

export const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded"
};

export const VALID_STATUS_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: ["refunded"],
  cancelled: [],
  refunded: []
};

export const statusOptions = {
  basic: [
    { label: "启用", value: "active" },
    { label: "停用", value: "inactive" }
  ],
  practitioner: [
    { label: "在职", value: "active" },
    { label: "休息", value: "resting" },
    { label: "离职/隐藏", value: "inactive" }
  ],
  schedule: [
    { label: "开放", value: "open" },
    { label: "关闭", value: "closed" }
  ],
  article: [
    { label: "草稿", value: "draft" },
    { label: "发布", value: "published" }
  ],
  roles: [
    { label: "普通会员", value: "member" },
    { label: "前台", value: "frontdesk" },
    { label: "店长", value: "manager" },
    { label: "商户管理员", value: "tenant_admin" },
    { label: "总部管理员", value: "owner" }
  ],
  bool: [
    { label: "是", value: true },
    { label: "否", value: false }
  ]
};
