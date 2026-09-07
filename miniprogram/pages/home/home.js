const { request } = require("../../utils/request");
const { getToken } = require("../../utils/auth");
const { isDev } = require("../../utils/env");
const mock = require("../../utils/mock-data");

// 数据源别名 → 后端接口（R8 区块数据来源配置）
// courses 复用 services 中 category=gym_course 的团课/私教项；membership 走独立会员卡接口
const SOURCE_API = {
  services: "/services",
  courses: "/services?category=gym_course",
  articles: "/articles",
  activities: "/activities",
  membership: "/membership-cards",
  coaches: "/practitioners"
};

// 拼接数据源 URL：合并区块自带 query + 门店 + 租户 slug（会员卡按租户过滤）
function buildSourceUrl(base, storeId, slug) {
  const [path, existing] = base.split("?");
  const params = existing ? [existing] : [];
  if (storeId) params.push(`storeId=${storeId}`);
  if (path.startsWith("/membership")) params.push(`tenantSlug=${slug}`);
  return params.length ? `${path}?${params.join("&")}` : path;
}

Page({
  data: {
    loading: true,
    page: null, // 页面引擎解析结果（terms / theme / nav / bookingRoute / sections）
    store: null,
    showPhoneOverlay: false
  },

  onLoad() {
    this.loadHome();
  },

  onShow() {
    this.checkPhoneAuth();
  },

  checkPhoneAuth() {
    if (isDev()) {
      this.setData({ showPhoneOverlay: false });
      return;
    }
    const token = getToken();
    this.setData({ showPhoneOverlay: !token });
  },

  async loadHome() {
    this.setData({ loading: true });
    try {
      const app = getApp();
      const slug = app.globalData.tenantSlug || "qingnang";

      const [resolved, stores] = await Promise.all([
        request(`/cpages/tenants/by-slug/${slug}/pages/home`),
        request("/stores")
      ]);
      const page = resolved || {};
      const store = stores.find((s) => s.id === app.globalData.storeId) || stores[0] || null;
      if (store) app.globalData.storeId = store.id;

      // 按区块声明的数据源并行取数（R8 区块数据来源配置）
      const sourceMap = {}; // source -> 列表
      const needed = new Set(
        (page.sections || [])
          .map((s) => s.payload && s.payload.source)
          .filter(Boolean)
      );
      const fetches = [];
      for (const src of needed) {
        const base = SOURCE_API[src];
        if (base && !sourceMap[src]) {
          sourceMap[src] = [];
          const url = buildSourceUrl(base, store ? store.id : null, slug);
          fetches.push(
            request(url)
              .then((list) => { sourceMap[src] = Array.isArray(list) ? list : []; })
              .catch(() => { sourceMap[src] = []; })
          );
        }
      }
      await Promise.all(fetches);

      // 为每个 section 预计算渲染列表（WXML 无法直接调用 JS 取数）
      const sections = (page.sections || []).map((s) => {
        const src = s.payload && s.payload.source;
        const items = src ? (sourceMap[src] || []) : [];
        return { ...s, items };
      });

      this.setData({
        loading: false,
        page: { ...page, sections },
        store
      });
      if (page.brand) wx.setNavigationBarTitle({ title: page.brand });
    } catch (error) {
      this.setData({ loading: false });
      if (isDev()) {
        // 开发态降级：用本地 mock 渲染，保证演示不中断
        this.setData({
          page: this.fallbackPage(),
          store: mock.stores ? mock.stores[0] : null
        });
        this.applyTabBar((mock.terms && mock.terms.nav) || []);
      } else {
        wx.showToast({ title: error.message || "首页加载失败", icon: "none" });
      }
    }
  },

  // Phase 2 模板化：tabBar 标题按租户术语字典渲染（索引 0-3 对应 首页/预约/档案/我的）
  applyTabBar(navLabels) {
    if (!Array.isArray(navLabels)) return;
    navLabels.slice(0, 4).forEach((label, i) => {
      if (label) {
        try { wx.setTabBarItem({ index: i, text: label }); } catch (_e) { /* 非 tab 页忽略 */ }
      }
    });
  },

  // 开发态兜底页面（术语来自 mock，不写死业务词）
  fallbackPage() {
    const terms = mock.terms || {};
    return {
      brand: mock.brand || "演示门店",
      tagline: terms.brand_tagline || "",
      theme: { primary: "#E76F3C", bg: "#F4F5F6", surface: "#FFFFFF", title: "#17191C", text: "#2D3035", muted: "#73777D", border: "#DEE1E4" },
      terms,
      nav: [terms.nav_home, terms.nav_book, terms.nav_record, terms.nav_me].filter(Boolean),
      bookingRoute: [terms.route_1, terms.route_2, terms.route_3].filter(Boolean).map((label, i) => ({ step: String(i + 1).padStart(2, "0"), label })),
      sections: [
        { section_key: "service_list", kind: "service_list", title: terms.service || "服务项目", payload: { source: "services" }, items: mock.services || [] },
        { section_key: "info_list", kind: "info_list", title: terms.info || "", payload: { source: "articles" }, items: mock.articles || [] }
      ]
    };
  },

  goArticleDetail(event) {
    const id = Number(event.currentTarget.dataset.id);
    if (!id) return;
    wx.navigateTo({ url: `/pages/article-detail/article-detail?id=${id}` });
  },

  goActivityDetail(event) {
    const id = Number(event.currentTarget.dataset.id);
    if (!id) return;
    wx.navigateTo({ url: `/pages/activity-detail/activity-detail?id=${id}` });
  },

  goBooking() {
    wx.switchTab({ url: "/pages/booking/booking" });
  },

  goToLogin() {
    wx.navigateTo({ url: "/pages/login/login" });
  }
});
