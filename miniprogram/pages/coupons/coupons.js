const { request } = require("../../utils/request");

Page({
  data: {
    coupons: [],
    tab: "unused",
    filteredCoupons: [],
    tabs: [
      { key: "unused", label: "可用" },
      { key: "used", label: "已使用" },
      { key: "expired", label: "已过期" }
    ]
  },

  onShow() {
    this.loadCoupons();
  },

  async loadCoupons() {
    try {
      const coupons = await request("/coupons");
      this.applyFilter(coupons, this.data.tab);
    } catch (error) {
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    }
  },

  applyFilter(coupons, tab) {
    this.setData({
      coupons,
      filteredCoupons: coupons.filter((c) => c.status === (tab || this.data.tab))
    });
  },

  switchTab(event) {
    const tab = event.currentTarget.dataset.tab;
    this.setData({ tab });
    this.applyFilter(this.data.coupons, tab);
  }
});
