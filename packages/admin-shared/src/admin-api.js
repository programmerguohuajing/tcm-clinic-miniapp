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
    stores: () => request("/admin/stores"),
    saveStore: (data) => request(data.id ? `/admin/stores/${data.id}` : "/admin/stores", { method: data.id ? "PATCH" : "POST", data }),
    services: (params) => request(`/admin/services${query(params)}`),
    saveService: (data) => request(data.id ? `/admin/services/${data.id}` : "/admin/services", { method: data.id ? "PATCH" : "POST", data }),
    practitioners: (params) => request(`/admin/practitioners${query(params)}`),
    savePractitioner: (data) => request(data.id ? `/admin/practitioners/${data.id}` : "/admin/practitioners", { method: data.id ? "PATCH" : "POST", data }),
    schedules: (params) => request(`/admin/schedules${query(params)}`),
    saveSchedule: (data) => request("/admin/schedules", { method: "POST", data }),
    bulkSchedules: (data) => request("/admin/schedules/bulk", { method: "POST", data }),
    orders: (params) => request(`/admin/orders${query(params)}`),
    updateOrderStatus: (id, status) => request(`/admin/orders/${id}/status`, { method: "PATCH", data: { status } }),
    commissionRules: () => request("/admin/commission-rules"),
    saveCommissionRule: (data) => request(data.id ? `/admin/commission-rules/${data.id}` : "/admin/commission-rules", { method: data.id ? "PATCH" : "POST", data }),
    homepageConfigs: (params) => request(`/admin/homepage-configs${query(params)}`),
    saveHomepageConfig: (data) => request(data.id ? `/admin/homepage-configs/${data.id}` : "/admin/homepage-configs", { method: data.id ? "PATCH" : "POST", data }),
    activities: (params) => request(`/admin/activities${query(params)}`),
    createActivity: (data) => request("/admin/activities", { method: "POST", data }),
    articles: (params) => request(`/admin/articles${query(params)}`),
    createArticle: (data) => request("/admin/articles", { method: "POST", data }),
    users: () => request("/admin/users"),
    updateUserRole: (id, data) => request(`/admin/users/${id}/role`, { method: "PATCH", data }),
    reviews: () => request("/admin/reviews"),
    updateReview: (id, data) => request(`/admin/reviews/${id}`, { method: "PATCH", data }),
    auditLogs: () => request("/admin/audit-logs")
  };
}
