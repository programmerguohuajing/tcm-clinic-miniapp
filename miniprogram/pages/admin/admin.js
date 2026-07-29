const { request } = require("../../utils/request");

const navItems = [
  { key: "dashboard", label: "经营看板" },
  { key: "stores", label: "多门店" },
  { key: "services", label: "服务项目" },
  { key: "practitioners", label: "技师管理" },
  { key: "schedules", label: "技师排班" },
  { key: "orders", label: "预约订单" },
  { key: "commissions", label: "提成结算" },
  { key: "homepage", label: "首页配置" },
  { key: "content", label: "内容营销" },
  { key: "users", label: "会员权限" },
  { key: "reviews", label: "评价管理" },
  { key: "payment", label: "支付配置" },
  { key: "audit", label: "操作日志" }
];

const statusMap = {
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
  paid: "已支付",
  unpaid: "未支付",
  published: "已发布",
  draft: "草稿",
  visible: "显示",
  hidden: "隐藏",
  true: "是",
  false: "否"
};

const statusOptions = {
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

const emptyDashboard = () => ({ cards: {}, storeRank: [], practitionerRank: [], serviceRank: [], commissions: [] });
const money = (value) => `¥${Number(value || 0).toFixed(2)}`;
const percentText = (value) => `${Math.round(Number(value || 0) * 100)}%`;
const dateText = (value) => (value ? String(value).slice(0, 10) : "");
const timeText = (value) => (value ? String(value).slice(0, 5) : "");
const statusLabel = (value) => statusMap[String(value)] || value || "-";
const jsonText = (value) => JSON.stringify(value || {}, null, 2);
const splitKeywords = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/[,，]/).map((item) => item.trim()).filter(Boolean);
};
const query = (params = {}) => {
  const pairs = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
  return pairs.length ? `?${pairs.join("&")}` : "";
};
const today = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const adminApi = {
  bootstrap: () => request("/admin/bootstrap"),
  dashboard: (params) => request(`/admin/dashboard${query(params)}`),
  stores: (params) => request(`/admin/stores${query(params)}`),
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
  commissionRules: (params) => request(`/admin/commission-rules${query(params)}`),
  saveCommissionRule: (data) => request(data.id ? `/admin/commission-rules/${data.id}` : "/admin/commission-rules", { method: data.id ? "PATCH" : "POST", data }),
  homepageConfigs: (params) => request(`/admin/homepage-configs${query(params)}`),
  saveHomepageConfig: (data) => request(data.id ? `/admin/homepage-configs/${data.id}` : "/admin/homepage-configs", { method: data.id ? "PATCH" : "POST", data }),
  activities: (params) => request(`/admin/activities${query(params)}`),
  createActivity: (data) => request("/admin/activities", { method: "POST", data }),
  articles: (params) => request(`/admin/articles${query(params)}`),
  createArticle: (data) => request("/admin/articles", { method: "POST", data }),
  users: (params) => request(`/admin/users${query(params)}`),
  updateUserRole: (id, data) => request(`/admin/users/${id}/role`, { method: "PATCH", data }),
  reviews: (params) => request(`/admin/reviews${query(params)}`),
  updateReview: (id, data) => request(`/admin/reviews/${id}`, { method: "PATCH", data }),
  auditLogs: (params) => request(`/admin/audit-logs${query(params)}`),
  paymentConfigs: (params) => request(`/admin/payment-configs${query(params)}`),
  savePaymentConfig: (id, data) => request(`/admin/payment-configs/${id}`, { method: "PATCH", data })
};

Page({
  data: {
    navItems,
    activeKey: "dashboard",
    activeLabel: "经营看板",
    storeId: "",
    storeLabel: "全部门店",
    storeOptions: [{ label: "全部门店", value: "" }],
    dashboard: emptyDashboard(),
    rows: [],
    extraRows: [],
    displayRows: [],
    loading: false,
    bootstrap: { stores: [], services: [], practitioners: [] },
    editor: { visible: false, title: "", fields: [], model: {}, saveKey: "" },
    toast: ""
  },

  onShow() {
    this.initAdmin();
  },

  async initAdmin() {
    await this.runLoad(async () => {
      await this.loadBootstrap();
      await this.loadActive();
    });
  },

  async runLoad(loader) {
    this.setData({ loading: true });
    try {
      await loader();
    } catch (error) {
      if (error.statusCode === 403) {
        wx.showToast({ title: "暂无管理端权限", icon: "none" });
        setTimeout(() => wx.navigateBack(), 800);
        return;
      }
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadBootstrap(force = false) {
    if (this.bootstrapLoaded && !force) return;
    const data = await adminApi.bootstrap();
    const bootstrap = {
      stores: data.stores || [],
      services: data.services || [],
      practitioners: data.practitioners || []
    };
    this.bootstrapLoaded = true;
    this.setData({
      bootstrap,
      storeOptions: [{ label: "全部门店", value: "" }, ...bootstrap.stores.map((item) => ({ label: item.name, value: item.id }))]
    });
  },

  async loadActive() {
    const { activeKey, storeId } = this.data;
    const params = { storeId };
    let rows = [];
    let extraRows = [];
    let dashboard = this.data.dashboard;

    if (activeKey === "dashboard") {
      dashboard = await adminApi.dashboard(params);
    } else if (activeKey === "stores") {
      rows = await adminApi.stores();
    } else if (activeKey === "services") {
      rows = await adminApi.services(params);
    } else if (activeKey === "practitioners") {
      rows = await adminApi.practitioners(params);
    } else if (activeKey === "schedules") {
      rows = await adminApi.schedules(params);
    } else if (activeKey === "orders") {
      rows = await adminApi.orders(params);
    } else if (activeKey === "commissions") {
      const result = await Promise.all([adminApi.commissionRules(), adminApi.dashboard(params)]);
      rows = result[0];
      extraRows = result[1].commissions || [];
    } else if (activeKey === "homepage") {
      rows = await adminApi.homepageConfigs(params);
    } else if (activeKey === "content") {
      const result = await Promise.all([adminApi.activities(params), adminApi.articles(params)]);
      rows = result[0].map((item) => ({ ...item, _type: "活动" }));
      extraRows = result[1].map((item) => ({ ...item, _type: "文章" }));
    } else if (activeKey === "users") {
      rows = await adminApi.users();
    } else if (activeKey === "reviews") {
      rows = await adminApi.reviews();
    } else if (activeKey === "payment") {
      rows = await adminApi.paymentConfigs();
    } else if (activeKey === "audit") {
      rows = await adminApi.auditLogs();
    }

    this.setData({ dashboard: this.formatDashboard(dashboard), rows, extraRows }, () => this.applyDisplayRows());
  },

  formatDashboard(data) {
    const dashboard = { ...emptyDashboard(), ...(data || {}) };
    dashboard.cards = dashboard.cards || {};
    dashboard.cardList = [
      { label: "营业额", value: money(dashboard.cards.revenue) },
      { label: "预约订单", value: dashboard.cards.orders || 0 },
      { label: "在职技师", value: dashboard.cards.practitioners || 0 },
      { label: "用户数", value: dashboard.cards.users || 0 },
      { label: "服务用户", value: dashboard.cards.served_users || 0 },
      { label: "客单价", value: money(dashboard.cards.avg_order) }
    ];
    dashboard.storeRank = (dashboard.storeRank || []).map((item) => ({ ...item, valueText: money(item.revenue) }));
    dashboard.practitionerRank = (dashboard.practitionerRank || []).map((item) => ({ ...item, valueText: money(item.revenue) }));
    dashboard.serviceRank = (dashboard.serviceRank || []).map((item) => ({ ...item, valueText: money(item.revenue) }));
    dashboard.commissions = (dashboard.commissions || []).map((item) => ({ ...item, valueText: money(item.commission_amount) }));
    return dashboard;
  },

  applyDisplayRows() {
    const { rows, extraRows } = this.data;
    const displayRows = [...rows, ...extraRows].map((row) => this.decorateRow(row));
    this.setData({ displayRows });
  },

  decorateRow(row) {
    const key = this.data.activeKey;
    const title = row.name || row.title || row.order_no || row.nickname || row.user_name || row.action || "未命名记录";
    let meta = row.store_name || row.city || row.phone || row.category || row.member_level || row.practitioner_name || "";
    let value = statusLabel(row.status !== undefined ? row.status : row.is_active !== undefined ? row.is_active : row.can_manage);
    let detail = row.description || row.subtitle || row.summary || row.address || row.content || "";

    if (key === "orders") {
      meta = `${row.service_name || "-"} · ${dateText(row.appointment_date)} ${timeText(row.start_time)}`;
      value = money(row.amount);
      detail = `${row.user_name || "-"} ${row.user_phone || ""}，${row.store_name || "-"}，${row.practitioner_name || "-"}`;
    } else if (key === "schedules") {
      meta = `${dateText(row.work_date)} ${timeText(row.start_time)}-${timeText(row.end_time)}`;
      detail = `${row.practitioner_name || "-"} · ${row.store_name || "未绑定门店"} · 容量 ${row.capacity || 0}`;
    } else if (key === "commissions") {
      meta = `${row.practitioner_name || "全部技师"} · ${row.service_name || "全部项目"}`;
      value = row.commission_amount !== undefined ? money(row.commission_amount) : percentText(row.rate);
      detail = row.gross_amount !== undefined ? `服务业绩 ${money(row.gross_amount)}` : `门槛 ${money(row.threshold_amount)}`;
    } else if (key === "content") {
      meta = `${row._type} · ${row.store_name || "通用"}`;
      value = row._type === "活动" ? money(row.price) : statusLabel(row.status);
    } else if (key === "homepage") {
      meta = `${row.section_key || "-"} · ${row.store_name || "通用"}`;
      detail = jsonText(row.payload || {}).slice(0, 120);
    } else if (key === "practitioners") {
      detail = `${row.title || ""} ${(row.specialties || []).join("、")}`;
    } else if (key === "reviews") {
      value = "★".repeat(row.rating || 0);
      meta = `${row.user_name || "-"} · ${row.practitioner_name || "-"} · ${row.store_name || "-"}`;
      detail = row.reply ? `${row.content || ""}\n回复：${row.reply}` : row.content || "";
    } else if (key === "payment") {
      title = row.configKeyLabel || row.config_key || "支付配置";
      meta = row.store_name || "全局配置";
      value = row.is_active !== false ? "启用" : "停用";
      detail = JSON.stringify(row.config_value || {}).slice(0, 160);
    } else if (key === "audit") {
      meta = `${row.user_name || "-"} · ${row.target_type || "-"} #${row.target_id || ""}`;
      value = dateText(row.created_at);
      detail = jsonText(row.detail || {}).slice(0, 160);
    } else if (key === "users") {
      value = money(row.total_spend);
      detail = `${statusLabel(row.admin_role)} · 管理入口：${statusLabel(row.can_manage)}`;
    } else if (key === "services") {
      value = money(row.price);
      meta = `${row.store_name || "通用"} · ${row.duration_minutes || 0} 分钟`;
    }

    return { ...row, titleText: title, metaText: meta, valueText: value, detailText: detail, statusText: statusLabel(row.status) };
  },

  async switchModule(event) {
    const key = event.currentTarget.dataset.key;
    if (key === this.data.activeKey) return;
    const active = navItems.find((item) => item.key === key) || navItems[0];
    this.setData({ activeKey: key, activeLabel: active.label, rows: [], extraRows: [], displayRows: [] });
    await this.runLoad(() => this.loadActive());
  },

  async cycleStore() {
    const options = this.data.storeOptions;
    const index = options.findIndex((item) => String(item.value) === String(this.data.storeId));
    const next = options[(index + 1) % options.length] || options[0];
    this.setData({ storeId: next.value || "", storeLabel: next.label });
    await this.runLoad(() => this.loadActive());
  },

  refreshAdmin() {
    this.runLoad(async () => {
      await this.loadBootstrap(true);
      await this.loadActive();
    });
  },

  openCreateEditor() {
    this.openEditor();
  },

  openSecondaryEditor() {
    const config = this.moduleConfig();
    if (!config || !config.secondaryEditor) return;
    this.showEditor(config.secondaryEditor());
  },

  openRowEditor(event) {
    const id = Number(event.currentTarget.dataset.id);
    const row = this.data.displayRows.find((item) => Number(item.id) === id);
    if (row) this.openEditor(row);
  },

  openEditor(row = {}) {
    const config = this.moduleConfig();
    if (!config || !config.primary) return;
    this.showEditor({
      title: row.id ? `编辑${config.title}` : config.primary,
      fields: config.fields(),
      model: config.model(row),
      saveKey: config.saveKey
    });
  },

  showEditor(editor) {
    const fields = editor.fields.map((field) => this.prepareField(field, editor.model));
    this.setData({ editor: { visible: true, title: editor.title, fields, model: editor.model, saveKey: editor.saveKey } });
  },

  prepareField(field, model) {
    const next = { ...field, value: model[field.name] === undefined || model[field.name] === null ? "" : model[field.name] };
    if (next.type === "select") {
      next.index = Math.max(0, (next.options || []).findIndex((item) => String(item.value) === String(model[next.name])));
      next.display = (next.options || [])[next.index]?.label || "请选择";
    }
    if (next.type === "checks") {
      const values = (model[next.name] || []).map(String);
      next.options = (next.options || []).map((item) => ({ ...item, checked: values.includes(String(item.value)) }));
    }
    return next;
  },

  closeEditor() {
    this.setData({ editor: { visible: false, title: "", fields: [], model: {}, saveKey: "" } });
  },

  stopTap() {},

  updateField(event) {
    const { name, type, fieldIndex } = event.currentTarget.dataset;
    const value = event.detail.value;
    const nextValue = type === "number" ? Number(value) : value;
    this.setData({ [`editor.model.${name}`]: nextValue, [`editor.fields[${fieldIndex}].value`]: nextValue });
  },

  updateSelect(event) {
    const { name, fieldIndex } = event.currentTarget.dataset;
    const index = Number(event.detail.value);
    const field = this.data.editor.fields[Number(fieldIndex)];
    const option = field.options[index];
    this.setData({
      [`editor.model.${name}`]: option ? option.value : "",
      [`editor.fields[${fieldIndex}].index`]: index,
      [`editor.fields[${fieldIndex}].display`]: option ? option.label : "请选择"
    });
  },

  updateChecks(event) {
    const { name, fieldIndex } = event.currentTarget.dataset;
    const values = event.detail.value.map(Number);
    const field = this.data.editor.fields[Number(fieldIndex)];
    const options = field.options.map((item) => ({ ...item, checked: values.includes(Number(item.value)) }));
    this.setData({ [`editor.model.${name}`]: values, [`editor.fields[${fieldIndex}].options`]: options });
  },

  async saveEditor() {
    const { saveKey, model } = this.data.editor;
    const data = this.normalizeModel(saveKey, model);
    if (!data) return;
    await this.runLoad(async () => {
      await this.saveByKey(saveKey, data);
      this.closeEditor();
      wx.showToast({ title: "保存成功" });
      await this.loadBootstrap(true);
      await this.loadActive();
    });
  },

  normalizeModel(saveKey, model) {
    try {
      if (saveKey === "savePractitioner") return { ...model, specialties: splitKeywords(model.specialties) };
      if (saveKey === "saveHomepageConfig") return { ...model, payload: JSON.parse(model.payloadText || "{}") };
      if (saveKey === "savePaymentConfig") {
        try { JSON.parse(model.configValue || "{}"); } catch { wx.showToast({ title: "JSON 格式不正确", icon: "none" }); return null; }
        return model;
      }
      if (saveKey === "bulkSchedules") {
        return {
          ...model,
          weekdays: String(model.weekdays || "").split(/[,，]/).map(Number).filter((item) => !Number.isNaN(item)),
          slots: String(model.slotsText || "").split("\n").filter(Boolean).map((line) => {
            const [range, capacity = 1] = line.split(",");
            const [startTime, endTime] = range.split("-");
            return { startTime: startTime.trim(), endTime: endTime.trim(), capacity: Number(capacity) };
          })
        };
      }
      return model;
    } catch (error) {
      wx.showToast({ title: "表单内容格式不正确", icon: "none" });
      return null;
    }
  },

  saveByKey(saveKey, data) {
    const actions = {
      saveStore: adminApi.saveStore,
      saveService: adminApi.saveService,
      savePractitioner: adminApi.savePractitioner,
      saveSchedule: adminApi.saveSchedule,
      bulkSchedules: adminApi.bulkSchedules,
      saveCommissionRule: adminApi.saveCommissionRule,
      saveHomepageConfig: adminApi.saveHomepageConfig,
      createActivity: adminApi.createActivity,
      createArticle: adminApi.createArticle,
      updateUserRole: (model) => adminApi.updateUserRole(model.id, model),
      updateReview: (model) => adminApi.updateReview(model.id, model),
      savePaymentConfig: (model) => adminApi.savePaymentConfig(model.id, {
        configValue: model.configValue,
        isActive: model.isActive
      })
    };
    return actions[saveKey](data);
  },

  async updateOrder(event) {
    const { id, status } = event.currentTarget.dataset;
    await this.runLoad(async () => {
      await adminApi.updateOrderStatus(id, status);
      wx.showToast({ title: "订单状态已更新" });
      await this.loadActive();
    });
  },

  moduleConfig() {
    const { activeKey, storeId, bootstrap } = this.data;
    const pickOptions = (rows, emptyLabel) => [
      ...(emptyLabel ? [{ label: emptyLabel, value: "" }] : []),
      ...rows.map((row) => ({ label: row.name, value: Number(row.id) }))
    ];
    const services = () => pickOptions(bootstrap.services, "全部项目");
    const practitioners = () => pickOptions(bootstrap.practitioners, "全部技师");
    const configs = {
      stores: {
        title: "多门店",
        primary: "新增门店",
        saveKey: "saveStore",
        fields: () => [
          { name: "name", label: "门店名称" },
          { name: "city", label: "城市" },
          { name: "address", label: "详细地址", type: "textarea" },
          { name: "phone", label: "联系电话" },
          { name: "businessHours", label: "营业时间" },
          { name: "isDefault", label: "默认门店", type: "select", options: statusOptions.bool },
          { name: "status", label: "状态", type: "select", options: statusOptions.basic }
        ],
        model: (row = {}) => ({ id: row.id, name: row.name || "", city: row.city || "", address: row.address || "", phone: row.phone || "", businessHours: row.business_hours || "", isDefault: row.is_default || false, status: row.status || "active" })
      },
      services: {
        title: "服务项目",
        primary: "新增项目",
        saveKey: "saveService",
        fields: () => [
          { name: "name", label: "项目名称" },
          { name: "category", label: "分类" },
          { name: "durationMinutes", label: "时长分钟", type: "number" },
          { name: "price", label: "价格", type: "number" },
          { name: "sortOrder", label: "排序", type: "number" },
          { name: "description", label: "项目说明", type: "textarea" },
          { name: "coverUrl", label: "封面图 URL" },
          { name: "isActive", label: "是否上架", type: "select", options: statusOptions.bool }
        ],
        model: (row = {}) => ({ id: row.id, storeId: row.store_id ? Number(row.store_id) : (storeId ? Number(storeId) : ""), name: row.name || "", category: row.category || "", description: row.description || "", durationMinutes: row.duration_minutes || 60, price: Number(row.price || 0), coverUrl: row.cover_url || "", sortOrder: row.sort_order || 0, isActive: row.is_active !== false })
      },
      practitioners: {
        title: "技师管理",
        primary: "新增技师",
        saveKey: "savePractitioner",
        fields: () => [
          { name: "name", label: "技师姓名" },
          { name: "title", label: "职称" },
          { name: "rating", label: "评分", type: "number" },
          { name: "specialties", label: "擅长方向，逗号分隔", type: "textarea" },
          { name: "bio", label: "简介", type: "textarea" },
          { name: "serviceIds", label: "可服务项目", type: "checks", options: services().filter((item) => item.value !== "") },
          { name: "status", label: "状态", type: "select", options: statusOptions.practitioner }
        ],
        model: (row = {}) => ({ id: row.id, storeId: row.store_id ? Number(row.store_id) : (storeId ? Number(storeId) : ""), name: row.name || "", title: row.title || "", rating: row.rating || 5, specialties: (row.specialties || []).join("，"), bio: row.bio || "", serviceIds: (row.services || []).map((service) => Number(service.id)), status: row.status || "active" })
      },
      schedules: {
        title: "技师排班",
        primary: "新增排班",
        secondary: "批量排班",
        saveKey: "saveSchedule",
        fields: () => [
          { name: "practitionerId", label: "技师", type: "select", options: practitioners().filter((item) => item.value !== "") },
          { name: "workDate", label: "日期" },
          { name: "startTime", label: "开始时间" },
          { name: "endTime", label: "结束时间" },
          { name: "capacity", label: "容量", type: "number" },
          { name: "status", label: "状态", type: "select", options: statusOptions.schedule }
        ],
        model: () => ({ storeId: storeId ? Number(storeId) : "", practitionerId: "", workDate: today(), startTime: "09:30", endTime: "10:30", capacity: 1, status: "open" }),
        secondaryEditor: () => ({
          title: "批量生成排班",
          saveKey: "bulkSchedules",
          fields: [
            { name: "practitionerId", label: "技师", type: "select", options: practitioners().filter((item) => item.value !== "") },
            { name: "startDate", label: "开始日期" },
            { name: "endDate", label: "结束日期" },
            { name: "weekdays", label: "星期，0-6 逗号分隔" },
            { name: "slotsText", label: "时间段，每行 09:30-10:30,2", type: "textarea" }
          ],
          model: { storeId: storeId ? Number(storeId) : "", practitionerId: "", startDate: today(), endDate: today(7), weekdays: "1,2,3,4,5", slotsText: "09:30-10:30,2\n14:00-15:00,2" }
        })
      },
      commissions: {
        title: "提成结算",
        primary: "新增规则",
        saveKey: "saveCommissionRule",
        fields: () => [
          { name: "name", label: "规则名称" },
          { name: "practitionerId", label: "指定技师", type: "select", options: practitioners() },
          { name: "serviceId", label: "指定项目", type: "select", options: services() },
          { name: "thresholdAmount", label: "业绩门槛", type: "number" },
          { name: "rate", label: "提成比例，例如 0.18", type: "number" },
          { name: "status", label: "状态", type: "select", options: statusOptions.basic }
        ],
        model: (row = {}) => ({ id: row.id, name: row.name || "", practitionerId: row.practitioner_id ? Number(row.practitioner_id) : "", serviceId: row.service_id ? Number(row.service_id) : "", thresholdAmount: row.threshold_amount || 0, rate: row.rate || 0.18, status: row.status || "active" })
      },
      homepage: {
        title: "首页配置",
        primary: "新增配置",
        saveKey: "saveHomepageConfig",
        fields: () => [
          { name: "sectionKey", label: "模块标识" },
          { name: "title", label: "标题" },
          { name: "sortOrder", label: "排序", type: "number" },
          { name: "payloadText", label: "JSON 配置", type: "textarea" },
          { name: "isActive", label: "是否启用", type: "select", options: statusOptions.bool }
        ],
        model: (row = {}) => ({ id: row.id, storeId: row.store_id ? Number(row.store_id) : (storeId ? Number(storeId) : ""), sectionKey: row.section_key || "hero", title: row.title || "", payloadText: jsonText(row.payload || { headline: "首页标题", button: "立即预约" }), sortOrder: row.sort_order || 0, isActive: row.is_active !== false })
      },
      content: {
        title: "内容营销",
        primary: "新增活动",
        secondary: "新增文章",
        saveKey: "createActivity",
        fields: () => [
          { name: "title", label: "活动标题" },
          { name: "subtitle", label: "副标题", type: "textarea" },
          { name: "price", label: "活动价", type: "number" },
          { name: "originalPrice", label: "原价", type: "number" },
          { name: "tag", label: "标签" },
          { name: "coverUrl", label: "封面图 URL" }
        ],
        model: () => ({ storeId: storeId ? Number(storeId) : "", title: "", subtitle: "", price: 99, originalPrice: 199, tag: "新客专享", coverUrl: "" }),
        secondaryEditor: () => ({
          title: "新增文章",
          saveKey: "createArticle",
          fields: [
            { name: "title", label: "文章标题" },
            { name: "category", label: "分类" },
            { name: "summary", label: "摘要", type: "textarea" },
            { name: "content", label: "正文", type: "textarea" },
            { name: "readMinutes", label: "阅读分钟", type: "number" },
            { name: "status", label: "状态", type: "select", options: statusOptions.article }
          ],
          model: { storeId: storeId ? Number(storeId) : "", title: "", category: "节气养生", summary: "", content: "", readMinutes: 3, status: "published" }
        })
      },
      users: {
        title: "会员权限",
        primary: "编辑权限",
        saveKey: "updateUserRole",
        fields: () => [
          { name: "adminRole", label: "后台角色", type: "select", options: statusOptions.roles },
          { name: "canManage", label: "显示管理入口", type: "select", options: statusOptions.bool }
        ],
        model: (row = {}) => ({ id: row.id, adminRole: row.admin_role || "member", canManage: row.can_manage })
      },
      reviews: {
        title: "评价管理",
        primary: "编辑评价",
        saveKey: "updateReview",
        fields: () => [
          { name: "reply", label: "门店回复", type: "textarea" },
          { name: "status", label: "展示状态", type: "select", options: [{ label: "显示", value: "visible" }, { label: "隐藏", value: "hidden" }] }
        ],
        model: (row = {}) => ({ id: row.id, reply: row.reply || "", status: row.status || "visible" })
      },
      payment: {
        title: "支付配置",
        primary: "保存配置",
        saveKey: "savePaymentConfig",
        fields: () => [
          { name: "configKey", label: "配置项" },
          { name: "configValue", label: "JSON 配置", type: "textarea" },
          { name: "isActive", label: "是否启用", type: "select", options: statusOptions.bool }
        ],
        model: (row = {}) => {
          const keyLabel = { wechat_pay: "微信支付", mock_payment: "模拟支付" };
          return {
            id: row.id,
            configKey: keyLabel[row.config_key] || row.config_key || "",
            configValue: JSON.stringify(row.config_value || {}, null, 2),
            isActive: row.is_active !== false
          };
        }
      }
    };
    return configs[activeKey];
  }
});
