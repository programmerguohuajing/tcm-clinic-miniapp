const { request } = require("../../utils/request");
const { isDev } = require("../../utils/env");
const mock = require("../../utils/mock-data");

Page({
  data: {
    store: null,
    hero: {
      headline: "为身体预约一段安静的时间",
      subtitle: "私人顾问为你安排合适技师、疗愈项目与安静房间。",
      button: "预约私人调理"
    },
    activities: isDev() ? mock.activities : [],
    articles: isDev() ? mock.articles : []
  },

  onLoad() {
    this.loadHome();
  },

  async loadHome() {
    try {
      const app = getApp();
      const stores = await request("/stores");
      const store = stores.find((item) => item.id === app.globalData.storeId) || stores[0] || null;
      if (store) app.globalData.storeId = store.id;
      const q = store ? `?storeId=${store.id}` : "";
      const [configs, activities, articles] = await Promise.all([
        request(`/homepage-configs${q}`),
        request(`/activities${q}`),
        request(`/articles${q}`)
      ]);
      const heroConfig = configs.find((item) => item.section_key === "hero");
      this.setData({
        store,
        hero: {
          ...this.data.hero,
          ...(heroConfig ? heroConfig.payload : {})
        },
        activities,
        articles
      });
    } catch (error) {
      if (isDev()) {
        this.setData({
          activities: mock.activities,
          articles: mock.articles
        });
      } else {
        wx.showToast({ title: error.message || "首页加载失败", icon: "none" });
      }
    }
  },

  selectStore(event) {
    const id = Number(event.currentTarget.dataset.id);
    getApp().globalData.storeId = id;
    this.loadHome();
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
  }
});
