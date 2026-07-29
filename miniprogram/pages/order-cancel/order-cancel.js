const { request } = require("../../utils/request");
const { STATUS_TEXT } = require("../../utils/constants");

Page({
  data: {
    orderId: null,
    order: null
  },

  onLoad(options) {
    this.setData({ orderId: Number(options.id) });
    this.loadOrder();
  },

  async loadOrder() {
    try {
      const order = await request(`/me/appointments/${this.data.orderId}`);
      this.setData({
        order: {
          ...order,
          statusText: STATUS_TEXT[order.status] || order.status,
          startLabel: order.start_time.slice(0, 5),
          endLabel: order.end_time.slice(0, 5)
        }
      });
    } catch (error) {
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    }
  },

  confirmCancel() {
    wx.showModal({
      title: "确认取消预约",
      content: `取消「${this.data.order?.service_name}」（${this.data.order?.appointment_date} ${this.data.order?.startLabel}）后需重新预约，确定取消吗？`,
      confirmText: "确认取消",
      confirmColor: "#c0392b",
      success: async ({ confirm }) => {
        if (!confirm) return;
        await this.doCancel();
      }
    });
  },

  async doCancel() {
    wx.showLoading({ title: "处理中" });
    try {
      await request(`/me/appointments/${this.data.orderId}/cancel`, {
        method: "PATCH",
        data: {}
      });
      wx.hideLoading();
      wx.showToast({ title: "已取消预约", icon: "success" });
      setTimeout(() => wx.navigateBack(), 1200);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "取消失败", icon: "none" });
    }
  }
});
