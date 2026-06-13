import { adminApi } from "@tcm-clinic/admin-shared/uni";
import { jsonText, splitKeywords } from "@tcm-clinic/admin-shared/format";
import { statusOptions } from "@tcm-clinic/admin-shared/constants";

const pickOptions = (rows, emptyLabel) => [
  ...(emptyLabel ? [{ label: emptyLabel, value: "" }] : []),
  ...rows.map((row) => ({ label: row.name, value: Number(row.id) }))
];

const parseJson = (value) => JSON.parse(value || "{}");

export function createModuleConfigs(ctx) {
  const stores = () => pickOptions(ctx.bootstrap.stores, "不绑定");
  const services = () => pickOptions(ctx.bootstrap.services, "全部项目");
  const practitioners = () => pickOptions(ctx.bootstrap.practitioners, "全部技师");
  const today = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

  return {
    stores: {
      title: "多门店",
      primary: "新增门店",
      load: () => adminApi.stores(),
      fields: () => [
        { name: "name", label: "门店名称" },
        { name: "city", label: "城市" },
        { name: "address", label: "详细地址", type: "textarea" },
        { name: "phone", label: "联系电话" },
        { name: "businessHours", label: "营业时间" },
        { name: "isDefault", label: "默认门店", type: "select", options: statusOptions.bool },
        { name: "status", label: "状态", type: "select", options: statusOptions.basic }
      ],
      model: (row = {}) => ({
        id: row.id,
        name: row.name || "",
        city: row.city || "",
        address: row.address || "",
        phone: row.phone || "",
        businessHours: row.business_hours || "",
        isDefault: row.is_default || false,
        status: row.status || "active"
      }),
      save: adminApi.saveStore
    },
    services: {
      title: "服务项目",
      primary: "新增项目",
      load: () => adminApi.services({ storeId: ctx.storeId.value }),
      fields: () => [
        { name: "storeId", label: "所属门店", type: "select", options: stores() },
        { name: "name", label: "项目名称" },
        { name: "category", label: "分类" },
        { name: "durationMinutes", label: "时长分钟", type: "number" },
        { name: "price", label: "价格", type: "number" },
        { name: "sortOrder", label: "排序", type: "number" },
        { name: "description", label: "项目说明", type: "textarea" },
        { name: "coverUrl", label: "封面图 URL" },
        { name: "isActive", label: "是否上架", type: "select", options: statusOptions.bool }
      ],
      model: (row = {}) => ({
        id: row.id,
        storeId: row.store_id ? Number(row.store_id) : (ctx.storeId.value ? Number(ctx.storeId.value) : ""),
        name: row.name || "",
        category: row.category || "",
        description: row.description || "",
        durationMinutes: row.duration_minutes || 60,
        price: row.price || 0,
        coverUrl: row.cover_url || "",
        sortOrder: row.sort_order || 0,
        isActive: row.is_active !== false
      }),
      save: adminApi.saveService
    },
    practitioners: {
      title: "技师管理",
      primary: "新增技师",
      load: () => adminApi.practitioners({ storeId: ctx.storeId.value }),
      fields: () => [
        { name: "storeId", label: "所属门店", type: "select", options: stores() },
        { name: "name", label: "技师姓名" },
        { name: "title", label: "职称" },
        { name: "rating", label: "评分", type: "number" },
        { name: "specialties", label: "擅长方向，逗号分隔", type: "textarea" },
        { name: "bio", label: "简介", type: "textarea" },
        { name: "serviceIds", label: "可服务项目", type: "checks", options: services().filter((item) => item.value !== "") },
        { name: "status", label: "状态", type: "select", options: statusOptions.practitioner }
      ],
      model: (row = {}) => ({
        id: row.id,
        storeId: row.store_id ? Number(row.store_id) : "",
        name: row.name || "",
        title: row.title || "",
        rating: row.rating || 5,
        specialties: (row.specialties || []).join("，"),
        bio: row.bio || "",
        serviceIds: (row.services || []).map((s) => Number(s.id)),
        status: row.status || "active"
      }),
      save: (model) => adminApi.savePractitioner({ ...model, specialties: splitKeywords(model.specialties) })
    },
    schedules: {
      title: "技师排班",
      primary: "新增排班",
      secondary: "批量排班",
      load: () => adminApi.schedules({ storeId: ctx.storeId.value }),
      fields: () => [
        { name: "storeId", label: "门店", type: "select", options: stores() },
        { name: "practitionerId", label: "技师", type: "select", options: practitioners() },
        { name: "workDate", label: "日期", type: "date" },
        { name: "startTime", label: "开始时间", type: "time" },
        { name: "endTime", label: "结束时间", type: "time" },
        { name: "capacity", label: "容量", type: "number" },
        { name: "status", label: "状态", type: "select", options: statusOptions.schedule }
      ],
      model: () => ({
        storeId: ctx.storeId.value ? Number(ctx.storeId.value) : "",
        practitionerId: "",
        workDate: today(),
        startTime: "09:30",
        endTime: "10:30",
        capacity: 1,
        status: "open"
      }),
      save: adminApi.saveSchedule,
      secondaryEditor: {
        title: "批量生成排班",
        fields: () => [
          { name: "storeId", label: "门店", type: "select", options: stores() },
          { name: "practitionerId", label: "技师", type: "select", options: practitioners() },
          { name: "startDate", label: "开始日期", type: "date" },
          { name: "endDate", label: "结束日期", type: "date" },
          { name: "weekdays", label: "星期，0-6 逗号分隔" },
          { name: "slotsText", label: "时间段，每行 09:30-10:30,2", type: "textarea" }
        ],
        model: () => ({
          storeId: ctx.storeId.value ? Number(ctx.storeId.value) : "",
          practitionerId: "",
          startDate: today(),
          endDate: today(7),
          weekdays: "1,2,3,4,5",
          slotsText: "09:30-10:30,2\n14:00-15:00,2"
        }),
        save: (model) => adminApi.bulkSchedules({
          ...model,
          weekdays: String(model.weekdays).split(/[,，]/).map(Number),
          slots: String(model.slotsText).split("\n").filter(Boolean).map((line) => {
            const [range, capacity = 1] = line.split(",");
            const [startTime, endTime] = range.split("-");
            return { startTime: startTime.trim(), endTime: endTime.trim(), capacity: Number(capacity) };
          })
        })
      }
    },
    commissions: {
      title: "提成结算",
      primary: "新增规则",
      load: async () => {
        const [rules, dashboard] = await Promise.all([
          adminApi.commissionRules(),
          adminApi.dashboard({ storeId: ctx.storeId.value })
        ]);
        ctx.extraRows.value = dashboard.commissions || [];
        return rules;
      },
      fields: () => [
        { name: "name", label: "规则名称" },
        { name: "practitionerId", label: "指定技师", type: "select", options: practitioners() },
        { name: "serviceId", label: "指定项目", type: "select", options: services() },
        { name: "thresholdAmount", label: "业绩门槛", type: "number" },
        { name: "rate", label: "提成比例，例如 0.18", type: "number" },
        { name: "status", label: "状态", type: "select", options: statusOptions.basic }
      ],
      model: (row = {}) => ({
        id: row.id,
        name: row.name || "",
        practitionerId: row.practitioner_id ? Number(row.practitioner_id) : "",
        serviceId: row.service_id ? Number(row.service_id) : "",
        thresholdAmount: row.threshold_amount || 0,
        rate: row.rate || 0.18,
        status: row.status || "active"
      }),
      save: adminApi.saveCommissionRule
    },
    homepage: {
      title: "首页配置",
      primary: "新增配置",
      load: () => adminApi.homepageConfigs({ storeId: ctx.storeId.value }),
      fields: () => [
        { name: "storeId", label: "门店", type: "select", options: stores() },
        { name: "sectionKey", label: "模块标识" },
        { name: "title", label: "标题" },
        { name: "sortOrder", label: "排序", type: "number" },
        { name: "payloadText", label: "JSON 配置", type: "textarea" },
        { name: "isActive", label: "是否启用", type: "select", options: statusOptions.bool }
      ],
      model: (row = {}) => ({
        id: row.id,
        storeId: row.store_id ? Number(row.store_id) : "",
        sectionKey: row.section_key || "hero",
        title: row.title || "",
        payloadText: jsonText(row.payload || { headline: "首页标题", button: "立即预约" }),
        sortOrder: row.sort_order || 0,
        isActive: row.is_active !== false
      }),
      save: (model) => adminApi.saveHomepageConfig({ ...model, payload: parseJson(model.payloadText) })
    },
    users: {
      title: "会员权限",
      primary: "",
      load: () => adminApi.users(),
      fields: () => [
        { name: "adminRole", label: "后台角色", type: "select", options: statusOptions.roles },
        { name: "canManage", label: "显示管理入口", type: "select", options: statusOptions.bool }
      ],
      model: (row = {}) => ({ id: row.id, adminRole: row.admin_role || "member", canManage: row.can_manage }),
      save: (model) => adminApi.updateUserRole(model.id, model)
    },
    reviews: {
      title: "评价管理",
      primary: "",
      load: () => adminApi.reviews(),
      fields: () => [
        { name: "reply", label: "门店回复", type: "textarea" },
        { name: "status", label: "展示状态", type: "select", options: [
          { label: "显示", value: "visible" },
          { label: "隐藏", value: "hidden" }
        ] }
      ],
      model: (row = {}) => ({
        id: row.id,
        reply: row.reply || "",
        status: row.status || "visible"
      }),
      save: (model) => adminApi.updateReview(model.id, model)
    },
    content: {
      title: "内容营销",
      primary: "新增活动",
      secondary: "新增文章",
      load: async () => {
        const [activities, articles] = await Promise.all([
          adminApi.activities({ storeId: ctx.storeId.value }),
          adminApi.articles({ storeId: ctx.storeId.value })
        ]);
        ctx.extraRows.value = articles.map((item) => ({ ...item, _type: "文章" }));
        return activities.map((item) => ({ ...item, _type: "活动" }));
      },
      fields: () => [
        { name: "storeId", label: "门店", type: "select", options: stores() },
        { name: "title", label: "活动标题" },
        { name: "subtitle", label: "副标题", type: "textarea" },
        { name: "price", label: "活动价", type: "number" },
        { name: "originalPrice", label: "原价", type: "number" },
        { name: "tag", label: "标签" },
        { name: "coverUrl", label: "封面图 URL" }
      ],
      model: () => ({
        storeId: ctx.storeId.value ? Number(ctx.storeId.value) : "",
        title: "",
        subtitle: "",
        price: 99,
        originalPrice: 199,
        tag: "新客专享",
        coverUrl: ""
      }),
      save: adminApi.createActivity,
      secondaryEditor: {
        title: "新增文章",
        fields: () => [
          { name: "storeId", label: "门店", type: "select", options: stores() },
          { name: "title", label: "文章标题" },
          { name: "category", label: "分类" },
          { name: "summary", label: "摘要", type: "textarea" },
          { name: "content", label: "正文", type: "textarea" },
          { name: "status", label: "状态", type: "select", options: statusOptions.article }
        ],
        model: () => ({
          storeId: ctx.storeId.value ? Number(ctx.storeId.value) : "",
          title: "",
          category: "节气养生",
          summary: "",
          content: "",
          status: "published"
        }),
        save: adminApi.createArticle
      }
    }
  };
}
