const { request } = require("../../utils/request");

Page({
  data: {
    store: null,
    services: [],
    selected: 0
  },

  onLoad(options) {
    const id = Number(options.id);
    if (!id) return wx.showToast({ title: "参数错误", icon: "none" });
    this.loadStore(id);
  },

  async loadStore(id) {
    try {
      const store = await request(`/stores/${id}`);
      const services = await request(`/services?storeId=${id}`);
      this.setData({
        store: {
          ...store,
          tags: (store.business_hours || "").split(" ").slice(0, 2)
        },
        services: Array.isArray(services) ? services : []
      });
      wx.setNavigationBarTitle({ title: store.name });
    } catch (error) {
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    }
  },

  callPhone() {
    const phone = this.data.store?.phone;
    if (!phone) return;
    wx.makePhoneCall({ phoneNumber: phone });
  },

  openMap() {
    const { latitude, longitude, name } = this.data.store;
    if (!latitude || !longitude) return;
    wx.openLocation({
      latitude: Number(latitude),
      longitude: Number(longitude),
      name: name || "门店",
      scale: 15
    });
  },

  goBooking() {
    const app = getApp();
    if (this.data.store.id) app.globalData.storeId = this.data.store.id;
    wx.switchTab({ url: "/pages/booking/booking" });
  }
});
