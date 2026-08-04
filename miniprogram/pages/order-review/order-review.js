const { request } = require("../../utils/request");

Page({
  data: {
    loading: true,
    orderId: null,
    order: null,
    rating: 0,
    content: "",
    submitting: false
  },

  onLoad(options) {
    this.setData({ orderId: Number(options.id) });
    this.loadOrder();
  },

  async loadOrder() {
    this. setData({ loading: true });
    try {
      const order = await request(`/me/appointments/${this.data.orderId}`);
      this.setData({
        loading: false,
        order: {
          ...order,
          startLabel: order.start_time.slice(0, 5),
          endLabel: order.end_time.slice(0, 5)
        }
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    }
  },

  onRatingTap(event) {
    this.setData({ rating: Number(event.currentTarget.dataset.rating) });
  },

  onContentInput(event) {
    this.setData({ content: event.detail.value });
  },

  async submitReview() {
    if (this.data.rating === 0) {
      wx.showToast({ title: "请选择评分", icon: "none" });
      return;
    }
    if (this.data.submitting) return;

    this.setData({ submitting: true });
    wx.showLoading({ title: "提交中" });
    try {
      await request("/reviews", {
        method: "POST",
        data: {
          appointmentId: this.data.orderId,
          rating: this.data.rating,
          content: this.data.content
        }
      });
      wx.hideLoading();
      wx.showToast({ title: "评价已提交", icon: "success" });
      setTimeout(() => wx.navigateBack(), 1200);
    } catch (error) {
      this.setData({ loading: false });
      wx.hideLoading();
      this.setData({ submitting: false });
      wx.showToast({ title: error.message || "提交失败", icon: "none" });
    }
  }
});
