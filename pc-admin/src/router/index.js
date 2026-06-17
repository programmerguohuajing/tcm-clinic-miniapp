import { createRouter, createWebHistory } from "vue-router";
import { getToken } from "../services/auth";

const routes = [
  { path: "/login", name: "login", component: () => import("../views/LoginView.vue"), meta: { public: true, title: "登录" } },
  { path: "/", name: "dashboard", component: () => import("../views/DashboardView.vue"), meta: { title: "经营看板" } },
  { path: "/stores", name: "stores", component: () => import("../views/StoresView.vue"), meta: { title: "多门店" } },
  { path: "/services", name: "services", component: () => import("../views/ServicesView.vue"), meta: { title: "服务项目" } },
  { path: "/practitioners", name: "practitioners", component: () => import("../views/PractitionersView.vue"), meta: { title: "技师管理" } },
  { path: "/schedules", name: "schedules", component: () => import("../views/SchedulesView.vue"), meta: { title: "技师排班" } },
  { path: "/technician-portal", name: "technicianPortal", component: () => import("../views/TechnicianPortalView.vue"), meta: { title: "技师工作台" } },
  { path: "/orders", name: "orders", component: () => import("../views/OrdersView.vue"), meta: { title: "预约订单" } },
  { path: "/commissions", name: "commissions", component: () => import("../views/CommissionsView.vue"), meta: { title: "提成结算" } },
  { path: "/homepage", name: "homepage", component: () => import("../views/HomepageConfigView.vue"), meta: { title: "首页配置" } },
  { path: "/content", name: "content", component: () => import("../views/ContentView.vue"), meta: { title: "内容营销" } },
  { path: "/users", name: "users", component: () => import("../views/UsersView.vue"), meta: { title: "会员权限" } },
  { path: "/reviews", name: "reviews", component: () => import("../views/ReviewsView.vue"), meta: { title: "评价管理" } },
  { path: "/audit", name: "audit", component: () => import("../views/AuditView.vue"), meta: { title: "操作日志" } }
];

const router = createRouter({
  history: createWebHistory("/pc-admin/"),
  routes
});

router.beforeEach((to) => {
  if (to.meta.public || getToken()) return true;
  return { name: "login", query: { redirect: to.fullPath } };
});

export default router;
