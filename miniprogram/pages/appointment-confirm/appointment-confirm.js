Page({
  data: {
    orderNo: ""
  },

  onLoad(options) {
    this.setData({ orderNo: options.orderNo || "" });
  },

  goProfile() {
    wx.switchTab({ url: "/pages/profile/profile" });
  }
});

