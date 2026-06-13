const { request } = require("../../utils/request");
const mock = require("../../utils/mock-data");

Page({
  data: {
    store: null,
    hero: {
      headline: "为身体预约一段安静的时间",
      subtitle: "私人顾问为你安排合适技师、疗愈项目与安静房间。",
      button: "预约私人调理"
    },
    activities: mock.activities,
    articles: mock.articles
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
      const query = store ? `?storeId=${store.id}` : "";
      const [configs, activities, articles] = await Promise.all([
        request(`/homepage-configs${query}`),
        request(`/activities${query}`),
        request(`/articles${query}`)
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
      console.warn("首页数据加载失败，使用兜底数据", error);
      this.setData({
        activities: mock.activities,
        articles: mock.articles
      });
    }
  },

  selectStore(event) {
    const id = Number(event.currentTarget.dataset.id);
    getApp().globalData.storeId = id;
    this.loadHome();
  },

  goBooking() {
    wx.switchTab({ url: "/pages/booking/booking" });
  }
});
