const { request } = require("../../utils/request");

Page({
  data: { activity: null },

  onLoad(options) {
    const id = Number(options.id);
    if (!id) return wx.showToast({ title: "参数错误", icon: "none" });
    this.loadActivity(id);
  },

  async loadActivity(id) {
    try {
      const activity = await request(`/activities/${id}`);
      this.setData({
        activity: {
          ...activity,
          startDate: activity.starts_at ? activity.starts_at.slice(0, 10) : "",
          endDate: activity.ends_at ? activity.ends_at.slice(0, 10) : ""
        }
      });
      wx.setNavigationBarTitle({ title: activity.title });
    } catch (error) {
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    }
  },

  goBooking() {
    wx.switchTab({ url: "/pages/booking/booking" });
  }
});
