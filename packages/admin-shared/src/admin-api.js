const query = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : "";
};

export function createAdminApi(request) {
  return {
    bootstrap: () => request("/admin/bootstrap"),
    dashboard: (params) => request(`/admin/dashboard${query(params)}`),
    stores: (params) => request(`/admin/stores${query(params)}`),
    saveStore: (data) => request(data.id ? `/admin/stores/${data.id}` : "/admin/stores", { method: data.id ? "PATCH" : "POST", data }),
    services: (params) => request(`/admin/services${query(params)}`),
    saveService: (data) => request(data.id ? `/admin/services/${data.id}` : "/admin/services", { method: data.id ? "PATCH" : "POST", data }),
    practitioners: (params) => request(`/admin/practitioners${query(params)}`),
    savePractitioner: (data) => request(data.id ? `/admin/practitioners/${data.id}` : "/admin/practitioners", { method: data.id ? "PATCH" : "POST", data }),
    deletePractitioner: (id) => request(`/admin/practitioners/${id}`, { method: "DELETE" }),
    schedules: (params) => request(`/admin/schedules${query(params)}`),
    saveSchedule: (data) => request("/admin/schedules", { method: "POST", data }),
    bulkSchedules: (data) => request("/admin/schedules/bulk", { method: "POST", data }),
    orders: (params) => request(`/admin/orders${query(params)}`),
    createOrder: (data) => request("/admin/orders", { method: "POST", data }),
    updateOrderStatus: (id, status) => request(`/admin/orders/${id}/status`, { method: "PATCH", data: { status } }),
    commissionRules: (params) => request(`/admin/commission-rules${query(params)}`),
    saveCommissionRule: (data) => request(data.id ? `/admin/commission-rules/${data.id}` : "/admin/commission-rules", { method: data.id ? "PATCH" : "POST", data }),
    homepageConfigs: (params) => request(`/admin/homepage-configs${query(params)}`),
    saveHomepageConfig: (data) => request(data.id ? `/admin/homepage-configs/${data.id}` : "/admin/homepage-configs", { method: data.id ? "PATCH" : "POST", data }),
    // 多租户页面引擎（Phase 1 / R6）
    tenants: (params) => request(`/cpages/tenants${query(params)}`),
    updateTenant: (id, data) => request(`/cpages/admin/tenants/${id}`, { method: "PATCH", data }),
    pageConfigs: (params) => request(`/cpages/admin/configs${query(params)}`),
    savePageConfig: (data) => request("/cpages/admin/configs", { method: "POST", data }),
    updatePageConfig: (id, data) => request(`/cpages/admin/configs/${id}`, { method: "PUT", data }),
    deletePageConfig: (id) => request(`/cpages/admin/configs/${id}`, { method: "DELETE" }),
    activities: (params) => request(`/admin/activities${query(params)}`),
    createActivity: (data) => request("/admin/activities", { method: "POST", data }),
    articles: (params) => request(`/admin/articles${query(params)}`),
    createArticle: (data) => request("/admin/articles", { method: "POST", data }),
    users: (params) => request(`/admin/users${query(params)}`),
    createUser: (data) => request("/admin/users", { method: "POST", data }),
    deleteUser: (id) => request(`/admin/users/${id}`, { method: "DELETE" }),
    updateUserRole: (id, data) => request(`/admin/users/${id}/role`, { method: "PATCH", data }),
    reviews: (params) => request(`/admin/reviews${query(params)}`),
    updateReview: (id, data) => request(`/admin/reviews/${id}`, { method: "PATCH", data }),
    auditLogs: (params) => request(`/admin/audit-logs${query(params)}`),
    technicianSummary: (params) => request(`/technician/me/summary${query(params)}`),
    technicianAppointments: (params) => request(`/technician/me/appointments${query(params)}`),
    technicianSchedules: (params) => request(`/technician/me/schedules${query(params)}`),
    saveTechnicianSchedule: (data) => request("/technician/me/schedules", { method: "POST", data }),
    technicianCommissions: (params) => request(`/technician/me/commissions${query(params)}`)
  };
};

// 支付与套餐（Phase 1.5d + Phase 3）
export function createCommerceApi(request) {
  const parent = createAdminApi(request);
  return {
    ...parent,
    // 商户交易视图（R9）：按租户交易列表 + 汇总
    merchantTransactions: (params) => request(`/payments/admin/merchant/transactions${query(params)}`),
    // 退款发起（R8）
    createRefund: (data) => request("/payments/refunds", { method: "POST", data }),
    // 套餐列表（Phase 3）
    plans: () => request("/cpages/admin/plans"),
    // 租户当前套餐 + 可用菜单（Phase 3 门控）
    tenantPlan: (tenantId) => request(`/cpages/admin/tenants/${tenantId}/plan`),
    // 设置租户套餐（管理员操作）
    setTenantPlan: (tenantId, planKey) => request(`/cpages/admin/tenants/${tenantId}/plan`, { method: "PUT", data: { planKey } }),
  };
}
