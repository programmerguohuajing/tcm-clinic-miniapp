export const navItems = [
  { path: "/", key: "dashboard", label: "经营看板" },
  { path: "/stores", key: "stores", label: "多门店" },
  { path: "/services", key: "services", label: "服务项目" },
  { path: "/practitioners", key: "practitioners", label: "技师管理" },
  { path: "/schedules", key: "schedules", label: "技师排班" },
  { path: "/orders", key: "orders", label: "预约订单" },
  { path: "/commissions", key: "commissions", label: "提成结算" },
  { path: "/homepage", key: "homepage", label: "首页配置" },
  { path: "/content", key: "content", label: "内容营销" },
  { path: "/users", key: "users", label: "会员权限" },
  { path: "/reviews", key: "reviews", label: "评价管理" },
  { path: "/audit", key: "audit", label: "操作日志" }
];

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
    { label: "总部管理员", value: "owner" }
  ],
  bool: [
    { label: "是", value: true },
    { label: "否", value: false }
  ]
};
