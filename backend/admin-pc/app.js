const API = "/api";
const DEMO_USER_ID = 1;

const state = {
  page: "dashboard",
  storeId: "",
  bootstrap: { stores: [], services: [], practitioners: [] },
  cache: {}
};

const navs = [
  ["dashboard", "经营看板"],
  ["stores", "多门店"],
  ["practitioners", "技师管理"],
  ["schedules", "技师排班"],
  ["orders", "预约订单"],
  ["commissions", "提成结算"],
  ["homepage", "首页配置"],
  ["content", "内容营销"],
  ["users", "会员权限"],
  ["reviews", "评价管理"],
  ["audit", "操作日志"]
];

const $ = (selector) => document.querySelector(selector);

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      "x-demo-user-id": DEMO_USER_ID
    },
    body: options.data ? JSON.stringify(options.data) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "请求失败");
  return payload.data ?? payload;
}

function money(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function dateText(value) {
  return value ? String(value).slice(0, 10) : "";
}

function timeText(value) {
  return value ? String(value).slice(0, 5) : "";
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

function optionList(items, selected, empty = "全部门店") {
  return [`<option value="">${empty}</option>`]
    .concat(items.map((item) => `<option value="${item.id}" ${String(selected || "") === String(item.id) ? "selected" : ""}>${item.name}</option>`))
    .join("");
}

function statusPill(value) {
  const off = ["inactive", "closed", "cancelled", "refunded", "hidden", "draft"].includes(value);
  const text = {
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
    hidden: "隐藏"
  }[value] || value;
  return `<span class="pill ${off ? "off" : ""}">${text}</span>`;
}

function renderNav() {
  $("#nav").innerHTML = navs.map(([key, label]) => (
    `<button class="nav-item ${state.page === key ? "active" : ""}" data-page="${key}">${label}</button>`
  )).join("");
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      state.page = button.dataset.page;
      render();
    });
  });
}

async function loadBootstrap() {
  state.bootstrap = await request("/admin/bootstrap");
  $("#storeFilter").innerHTML = optionList(state.bootstrap.stores, state.storeId);
}

async function render() {
  renderNav();
  $("#pageTitle").textContent = navs.find(([key]) => key === state.page)?.[1] || "管理端";
  const view = $("#view");
  view.innerHTML = `<div class="empty">正在调取经营脉络...</div>`;
  try {
    await loadBootstrap();
    const renderer = renderers[state.page];
    view.innerHTML = await renderer();
    bindPageActions();
  } catch (error) {
    view.innerHTML = `<div class="empty">${error.message}</div>`;
  }
}

function table(headers, rows) {
  if (!rows.length) return `<div class="empty">暂无数据，点击右上角新增。</div>`;
  return `<div class="table-card"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

function rankCard(title, rows, labelKey, valueKey) {
  const max = Math.max(...rows.map((r) => Number(r[valueKey] || 0)), 1);
  return `<div class="card"><p class="eyebrow">${title}</p><div class="bar-list">${
    rows.map((row) => `<div class="bar-row"><span>${row[labelKey] || "未命名"}</span><div class="bar"><i style="width:${Math.max(Number(row[valueKey] || 0) / max * 100, 5)}%"></i></div><strong>${row[valueKey]}</strong></div>`).join("")
  }</div></div>`;
}

const renderers = {
  async dashboard() {
    const data = await request(`/admin/dashboard${state.storeId ? `?storeId=${state.storeId}` : ""}`);
    const c = data.cards;
    return `
      <div class="grid cards">
        <div class="card metric"><span>营业额</span><strong>${money(c.revenue)}</strong></div>
        <div class="card metric"><span>预约订单</span><strong>${c.orders}</strong></div>
        <div class="card metric"><span>服务用户</span><strong>${c.served_users}</strong></div>
        <div class="card metric"><span>客单价</span><strong>${money(c.avg_order)}</strong></div>
      </div>
      <div class="grid two section-headless">
        ${rankCard("门店收入排行", data.storeRank, "store_name", "revenue")}
        ${rankCard("技师业绩排行", data.practitionerRank, "practitioner_name", "revenue")}
      </div>
      <div class="grid two section-headless">
        ${rankCard("项目销售排行", data.serviceRank, "service_name", "orders")}
        ${rankCard("提成预估排行", data.commissions, "practitioner_name", "commission_amount")}
      </div>`;
  },

  async stores() {
    const rows = await request("/admin/stores");
    return withAdd("门店列表", "新增门店", "store", table(["门店", "城市", "地址", "电话", "营业时间", "状态", "操作"], rows.map((r) => `
      <tr><td>${r.name}</td><td>${r.city || "-"}</td><td>${r.address}</td><td>${r.phone || "-"}</td><td>${r.business_hours || "-"}</td><td>${statusPill(r.status)} ${r.is_default ? '<span class="pill">默认</span>' : ""}</td><td><button class="ghost mini edit-store" data-row='${json(r)}'>编辑</button></td></tr>`)));
  },

  async practitioners() {
    const rows = await request(`/admin/practitioners${state.storeId ? `?storeId=${state.storeId}` : ""}`);
    return withAdd("技师档案", "新增技师", "practitioner", table(["技师", "门店", "职称", "擅长", "服务项目", "评分", "状态", "操作"], rows.map((r) => `
      <tr><td>${r.name}</td><td>${r.store_name || "-"}</td><td>${r.title}</td><td>${(r.specialties || []).join("、")}</td><td>${(r.services || []).map((s) => s.name).join("、") || "-"}</td><td>${r.rating}</td><td>${statusPill(r.status)}</td><td><button class="ghost mini edit-practitioner" data-row='${json(r)}'>编辑</button></td></tr>`)));
  },

  async schedules() {
    const rows = await request(`/admin/schedules${state.storeId ? `?storeId=${state.storeId}` : ""}`);
    return `
      <div class="section-head"><h2>排班日历</h2><div class="actions"><button class="primary" data-open="schedule">新增排班</button><button class="ghost" data-open="bulkSchedule">批量排班</button></div></div>
      ${table(["日期", "时间", "门店", "技师", "容量", "状态"], rows.map((r) => `
        <tr><td>${dateText(r.work_date)}</td><td>${timeText(r.start_time)}-${timeText(r.end_time)}</td><td>${r.store_name || "-"}</td><td>${r.practitioner_name}</td><td>${r.capacity}</td><td>${statusPill(r.status)}</td></tr>`))}`;
  },

  async orders() {
    const rows = await request(`/admin/orders${state.storeId ? `?storeId=${state.storeId}` : ""}`);
    const body = rows.map((r) => {
      const actions = [];
      if (r.status === "pending") {
        actions.push(`<button class="ghost mini order-status" data-id="${r.id}" data-status="confirmed">确认</button>`);
      }
      if (r.status === "confirmed") {
        actions.push(`<button class="primary mini order-status" data-id="${r.id}" data-status="completed">核销</button>`);
      }
      if (r.status === "pending" || r.status === "confirmed") {
        actions.push(`<button class="danger mini order-status" data-id="${r.id}" data-status="cancelled">取消</button>`);
      }
      return `<tr><td>${r.order_no}</td><td>${r.user_name}<br>${r.user_phone || ""}</td><td>${r.service_name}</td><td>${r.store_name || "-"}</td><td>${r.practitioner_name}</td><td>${dateText(r.appointment_date)} ${timeText(r.start_time)}</td><td>${money(r.amount)}</td><td>${statusPill(r.status)}</td><td class="actions">${actions.join("")}</td></tr>`;
    }).join("");
    return `<div class="section-head"><h2>预约订单</h2><button class="primary" data-open="phoneOrder">新建订单</button></div>${table(["订单号", "用户", "项目", "门店", "技师", "时间", "金额", "状态", "操作"], body || `<tr><td colspan="9"><div class="empty">暂无数据，点击右上角新建订单。</div></td></tr>`)}`;
  },

  async commissions() {
    const rules = await request("/admin/commission-rules");
    const dashboard = await request(`/admin/dashboard${state.storeId ? `?storeId=${state.storeId}` : ""}`);
    return `${withAdd("提成规则", "新增规则", "commission", table(["规则", "技师", "项目", "门槛", "比例", "状态", "操作"], rules.map((r) => `
      <tr><td>${r.name}</td><td>${r.practitioner_name || "全部"}</td><td>${r.service_name || "全部"}</td><td>${money(r.threshold_amount)}</td><td>${Math.round(Number(r.rate) * 100)}%</td><td>${statusPill(r.status)}</td><td><button class="ghost mini edit-commission" data-row='${json(r)}'>编辑</button></td></tr>`)))}
      <div class="section-head"><h2>本期提成预估</h2></div>
      ${table(["技师", "业绩", "预估提成"], dashboard.commissions.map((r) => `<tr><td>${r.practitioner_name}</td><td>${money(r.gross_amount)}</td><td>${money(r.commission_amount)}</td></tr>`))}`;
  },

  async homepage() {
    const rows = await request(`/admin/homepage-configs${state.storeId ? `?storeId=${state.storeId}` : ""}`);
    return withAdd("小程序首页配置", "新增配置", "homepage", table(["门店", "模块", "标题", "配置内容", "排序", "状态", "操作"], rows.map((r) => `
      <tr><td>${r.store_name || "通用"}</td><td>${r.section_key}</td><td>${r.title}</td><td><code>${escapeHtml(JSON.stringify(r.payload))}</code></td><td>${r.sort_order}</td><td>${statusPill(r.is_active ? "active" : "inactive")}</td><td><button class="ghost mini edit-homepage" data-row='${json(r)}'>编辑</button></td></tr>`)));
  },

  async content() {
    const [activities, articles] = await Promise.all([
      request(`/admin/activities${state.storeId ? `?storeId=${state.storeId}` : ""}`),
      request(`/admin/articles${state.storeId ? `?storeId=${state.storeId}` : ""}`)
    ]);
    return `${withAdd("活动管理", "新增活动", "activity", table(["门店", "活动", "价格", "标签", "状态"], activities.map((r) => `<tr><td>${r.store_name || "通用"}</td><td>${r.title}<br>${r.subtitle || ""}</td><td>${money(r.price)}</td><td>${r.tag || "-"}</td><td>${statusPill(r.is_active ? "active" : "inactive")}</td></tr>`)))}
      ${withAdd("文章管理", "新增文章", "article", table(["门店", "标题", "分类", "阅读", "状态"], articles.map((r) => `<tr><td>${r.store_name || "通用"}</td><td>${r.title}<br>${r.summary || ""}</td><td>${r.category || "-"}</td><td>${r.read_minutes} 分钟</td><td>${statusPill(r.status)}</td></tr>`)))}`;
  },

  async users() {
    const rows = await request("/admin/users");
    return table(["用户", "手机号", "会员", "消费", "预约", "角色", "管理权限", "操作"], rows.map((r) => `
      <tr><td>${r.nickname}</td><td>${r.phone || "-"}</td><td>${r.member_level}</td><td>${money(r.total_spend)}</td><td>${r.appointment_count}</td><td>${r.admin_role}</td><td>${r.can_manage ? "有" : "无"}</td><td><button class="ghost mini edit-user" data-row='${json(r)}'>配置权限</button></td></tr>`));
  },

  async reviews() {
    const rows = await request("/admin/reviews");
    return table(["用户", "门店", "技师", "评分", "内容", "回复", "状态"], rows.map((r) => `<tr><td>${r.user_name || "-"}</td><td>${r.store_name || "-"}</td><td>${r.practitioner_name || "-"}</td><td>${"★".repeat(r.rating)}</td><td>${r.content || "-"}</td><td>${r.reply || "-"}</td><td>${statusPill(r.status)}</td></tr>`));
  },

  async audit() {
    const rows = await request("/admin/audit-logs");
    return table(["时间", "操作人", "动作", "对象", "详情"], rows.map((r) => `<tr><td>${new Date(r.created_at).toLocaleString()}</td><td>${r.user_name || "-"}</td><td>${r.action}</td><td>${r.target_type || "-"} #${r.target_id || ""}</td><td><code>${escapeHtml(JSON.stringify(r.detail))}</code></td></tr>`));
  }
};

function withAdd(title, button, type, content) {
  return `<div class="section-head"><h2>${title}</h2><button class="primary" data-open="${type}">${button}</button></div>${content}`;
}

function json(row) {
  return escapeHtml(JSON.stringify(row));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function field(name, label, value = "", type = "text", wide = false, options = null) {
  const input = options
    ? `<select name="${name}">${options}</select>`
    : type === "textarea"
      ? `<textarea name="${name}">${escapeHtml(value)}</textarea>`
      : `<input name="${name}" type="${type}" value="${escapeHtml(value ?? "")}" />`;
  return `<div class="field ${wide ? "wide" : ""}"><label>${label}</label>${input}</div>`;
}

function boolOptions(value) {
  return `<option value="true" ${value ? "selected" : ""}>是</option><option value="false" ${!value ? "selected" : ""}>否</option>`;
}

function statusOptions(value, options = [["active", "启用"], ["inactive", "停用"]]) {
  return options.map(([key, label]) => `<option value="${key}" ${value === key ? "selected" : ""}>${label}</option>`).join("");
}

function serviceOptions(selected = []) {
  const set = new Set((selected || []).map(String));
  return state.bootstrap.services.map((s) => `<label><input type="checkbox" name="serviceIds" value="${s.id}" ${set.has(String(s.id)) ? "checked" : ""}/> ${s.name}</label>`).join("");
}

const editors = {
  store: {
    title: (r) => r.id ? "编辑门店" : "新增门店",
    endpoint: (r) => r.id ? `/admin/stores/${r.id}` : "/admin/stores",
    method: (r) => r.id ? "PATCH" : "POST",
    fields: (r = {}) => [
      field("name", "门店名称", r.name),
      field("city", "城市", r.city),
      field("address", "详细地址", r.address, "text", true),
      field("phone", "联系电话", r.phone),
      field("businessHours", "营业时间", r.business_hours),
      field("isDefault", "默认门店", r.is_default, "text", false, boolOptions(r.is_default)),
      field("status", "状态", r.status || "active", "text", false, statusOptions(r.status || "active"))
    ]
  },
  practitioner: {
    title: (r) => r.id ? "编辑技师" : "新增技师",
    endpoint: (r) => r.id ? `/admin/practitioners/${r.id}` : "/admin/practitioners",
    method: (r) => r.id ? "PATCH" : "POST",
    useCurrentStore: true,
    fields: (r = {}) => [
      field("name", "技师姓名", r.name),
      field("title", "职称", r.title),
      field("rating", "评分", r.rating || 5, "number"),
      field("specialties", "擅长方向，逗号分隔", (r.specialties || []).join("，"), "text", true),
      field("bio", "简介", r.bio, "textarea", true),
      `<div class="field wide"><label>可服务项目</label><div class="checks">${serviceOptions((r.services || []).map((s) => s.id))}</div></div>`,
      field("status", "状态", r.status || "active", "text", false, statusOptions(r.status || "active", [["active", "在职"], ["resting", "休息"], ["inactive", "离职/隐藏"]]))
    ]
  },
  schedule: {
    title: () => "新增排班",
    endpoint: () => "/admin/schedules",
    method: () => "POST",
    useCurrentStore: true,
    fields: () => [
      field("practitionerId", "技师", "", "text", false, practitionerOptions()),
      field("workDate", "日期", new Date().toISOString().slice(0, 10), "date"),
      field("startTime", "开始时间", "09:30", "time"),
      field("endTime", "结束时间", "10:30", "time"),
      field("capacity", "容量", 1, "number"),
      field("status", "状态", "open", "text", false, statusOptions("open", [["open", "开放"], ["closed", "关闭"]]))
    ]
  },
  bulkSchedule: {
    title: () => "批量生成排班",
    endpoint: () => "/admin/schedules/bulk",
    method: () => "POST",
    useCurrentStore: true,
    fields: () => [
      field("practitionerId", "技师", "", "text", false, practitionerOptions()),
      field("startDate", "开始日期", new Date().toISOString().slice(0, 10), "date"),
      field("endDate", "结束日期", new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), "date"),
      field("weekdays", "星期，0-6 逗号分隔", "1,2,3,4,5"),
      field("slotsText", "时间段，每行 09:30-10:30,2", "09:30-10:30,2\n14:00-15:00,2", "textarea", true)
    ],
    transform: (data) => ({
      ...data,
      weekdays: String(data.weekdays).split(",").map(Number),
      slots: String(data.slotsText).split("\n").filter(Boolean).map((line) => {
        const [range, capacity = 1] = line.split(",");
        const [startTime, endTime] = range.split("-");
        return { startTime: startTime.trim(), endTime: endTime.trim(), capacity: Number(capacity) };
      })
    })
  },
  commission: {
    title: (r) => r.id ? "编辑提成规则" : "新增提成规则",
    endpoint: (r) => r.id ? `/admin/commission-rules/${r.id}` : "/admin/commission-rules",
    method: (r) => r.id ? "PATCH" : "POST",
    fields: (r = {}) => [
      field("name", "规则名称", r.name),
      field("practitionerId", "指定技师", r.practitioner_id, "text", false, practitionerOptions(r.practitioner_id, "全部技师")),
      field("serviceId", "指定项目", r.service_id, "text", false, serviceSelectOptions(r.service_id, "全部项目")),
      field("thresholdAmount", "业绩门槛", r.threshold_amount || 0, "number"),
      field("rate", "提成比例，例如 0.18", r.rate || 0.18, "number"),
      field("status", "状态", r.status || "active", "text", false, statusOptions(r.status || "active"))
    ]
  },
  homepage: {
    title: (r) => r.id ? "编辑首页配置" : "新增首页配置",
    endpoint: (r) => r.id ? `/admin/homepage-configs/${r.id}` : "/admin/homepage-configs",
    method: (r) => r.id ? "PATCH" : "POST",
    useCurrentStore: true,
    fields: (r = {}) => [
      field("sectionKey", "模块标识", r.section_key || "hero"),
      field("title", "标题", r.title),
      field("sortOrder", "排序", r.sort_order || 0, "number"),
      field("payloadText", "JSON 配置", JSON.stringify(r.payload || { headline: "首页标题", button: "立即预约" }, null, 2), "textarea", true),
      field("isActive", "是否启用", r.is_active !== false, "text", false, boolOptions(r.is_active !== false))
    ],
    transform: (data) => ({ ...data, payload: JSON.parse(data.payloadText || "{}") })
  },
  activity: {
    title: () => "新增活动",
    endpoint: () => "/admin/activities",
    method: () => "POST",
    useCurrentStore: true,
    fields: () => [
      field("title", "活动标题"),
      field("subtitle", "副标题", "", "text", true),
      field("price", "活动价", 99, "number"),
      field("originalPrice", "原价", 199, "number"),
      field("tag", "标签", "新客专享"),
      field("coverUrl", "封面图 URL", "", "text", true)
    ]
  },
  article: {
    title: () => "新增文章",
    endpoint: () => "/admin/articles",
    method: () => "POST",
    useCurrentStore: true,
    fields: () => [
      field("title", "文章标题"),
      field("category", "分类", "节气养生"),
      field("summary", "摘要", "", "text", true),
      field("content", "正文", "", "textarea", true),
      field("status", "状态", "published", "text", false, statusOptions("published", [["draft", "草稿"], ["published", "发布"]]))
    ]
  },
  user: {
    title: (r) => `配置 ${r.nickname} 的权限`,
    endpoint: (r) => `/admin/users/${r.id}/role`,
    method: () => "PATCH",
    fields: (r = {}) => [
      field("adminRole", "后台角色", r.admin_role || "member", "text", false, statusOptions(r.admin_role || "member", [["member", "普通会员"], ["frontdesk", "前台"], ["manager", "店长"], ["owner", "总部管理员"]])),
      field("canManage", "显示管理入口", r.can_manage, "text", false, boolOptions(r.can_manage))
    ]
  },
  phoneOrder: {
    title: () => "电话预约",
    endpoint: () => "/admin/orders",
    method: () => "POST",
    useCurrentStore: true,
    transform: (data) => {
      if (data.customerName === "") data.customerName = undefined;
      if (data.note === "") data.note = undefined;
      return data;
    },
    fields: () => [
      field("customerPhone", "客户手机号 *", "", "tel"),
      field("customerName", "客户姓名（选填）", "", "text"),
      field("serviceId", "服务项目", "", "text", false, serviceSelectOptions("", "请选择项目")),
      field("practitionerId", "技师", "", "text", false, practitionerOptions("", "请选择技师")),
      field("scheduleId", "排班时段", "", "text", false, `<option value="">请先选择技师</option>`),
      field("note", "备注", "", "textarea", true)
    ]
  }
};

function practitionerOptions(value = "", empty = "请选择技师") {
  return [`<option value="">${empty}</option>`]
    .concat(state.bootstrap.practitioners.map((p) => `<option value="${p.id}" ${String(value || "") === String(p.id) ? "selected" : ""}>${p.name}</option>`))
    .join("");
}

function serviceSelectOptions(value = "", empty = "请选择项目") {
  return [`<option value="">${empty}</option>`]
    .concat(state.bootstrap.services.map((s) => `<option value="${s.id}" ${String(value || "") === String(s.id) ? "selected" : ""}>${s.name}</option>`))
    .join("");
}

function collectForm(form) {
  const data = {};
  const formData = new FormData(form);
  for (const [key, value] of formData.entries()) {
    if (key === "serviceIds") continue;
    if (value === "") continue;
    if (value === "true" || value === "false") data[key] = value === "true";
    else if (["storeId", "practitionerId", "serviceId", "scheduleId", "capacity", "sortOrder", "readMinutes"].includes(key)) data[key] = Number(value);
    else data[key] = value;
  }
  const serviceIds = formData.getAll("serviceIds").map(Number);
  if (serviceIds.length) data.serviceIds = serviceIds;
  return data;
}

function resolveEditorStoreId(row = {}) {
  const storeId = row.store_id || row.storeId || state.storeId;
  return storeId ? Number(storeId) : "";
}

async function loadScheduleOptions(practitionerId, storeId) {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const slots = await request(`/schedules?practitionerId=${practitionerId}&date=${today}&storeId=${storeId || ""}`);
    const available = (slots || []).filter((s) => s.available && s.status === "open");
    return available.map((s) => `<option value="${s.id}">${s.work_date} ${s.start_time}-${s.end_time}</option>`).join("");
  } catch {
    return "";
  }
}

function openEditor(type, row = {}) {
  const config = editors[type];
  const dialog = $("#editor");
  $("#editorTitle").textContent = config.title(row);
  $("#editorFields").innerHTML = config.fields(row).join("");
  const save = $("#saveEditor");
  save.onclick = async (event) => {
    event.preventDefault();
    try {
      let data = collectForm(dialog.querySelector("form"));
      if (config.useCurrentStore && data.storeId === undefined) {
        const storeId = resolveEditorStoreId(row);
        if (storeId) data.storeId = storeId;
      }
      if (config.transform) data = config.transform(data);
      delete data.payloadText;
      delete data.slotsText;
      await request(config.endpoint(row), { method: config.method(row), data });
      dialog.close();
      toast("保存成功");
      render();
    } catch (error) {
      toast(error.message);
    }
  };

  // For phoneOrder editor, load schedule options when practitioner changes
  if (type === "phoneOrder") {
    const practitionerSelect = dialog.querySelector("[name='practitionerId']");
    const scheduleSelect = dialog.querySelector("[name='scheduleId']");
    if (practitionerSelect) {
      const refreshSchedules = async () => {
        const pid = Number(practitionerSelect.value);
        if (!pid) {
          scheduleSelect.innerHTML = `<option value="">请先选择技师</option>`;
          return;
        }
        scheduleSelect.innerHTML = `<option value="">加载中...</option>`;
        const options = await loadScheduleOptions(pid, state.storeId);
        scheduleSelect.innerHTML = options || `<option value="">暂无可用排班</option>`;
      };
      practitionerSelect.addEventListener("change", refreshSchedules);
      // Pre-load if a practitioner is already selected
      if (practitionerSelect.value) refreshSchedules();
    }
  }

  dialog.showModal();
}

function bindPageActions() {
  document.querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", () => openEditor(button.dataset.open)));
  document.querySelectorAll(".edit-store").forEach((button) => button.addEventListener("click", () => openEditor("store", JSON.parse(button.dataset.row))));
  document.querySelectorAll(".edit-practitioner").forEach((button) => button.addEventListener("click", () => openEditor("practitioner", JSON.parse(button.dataset.row))));
  document.querySelectorAll(".edit-commission").forEach((button) => button.addEventListener("click", () => openEditor("commission", JSON.parse(button.dataset.row))));
  document.querySelectorAll(".edit-homepage").forEach((button) => button.addEventListener("click", () => openEditor("homepage", JSON.parse(button.dataset.row))));
  document.querySelectorAll(".edit-user").forEach((button) => button.addEventListener("click", () => openEditor("user", JSON.parse(button.dataset.row))));
  document.querySelectorAll(".order-status").forEach((button) => button.addEventListener("click", async () => {
    await request(`/admin/orders/${button.dataset.id}/status`, { method: "PATCH", data: { status: button.dataset.status } });
    toast("订单状态已更新");
    render();
  }));
}

$("#storeFilter").addEventListener("change", (event) => {
  state.storeId = event.target.value;
  render();
});

$("#refreshBtn").addEventListener("click", render);

render();
