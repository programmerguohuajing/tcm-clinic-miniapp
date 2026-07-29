const { request } = require("../../utils/request");

Page({
  data: {
    orderId: null,
    order: null,
    paying: false
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
          startLabel: order.start_time.slice(0, 5),
          endLabel: order.end_time.slice(0, 5)
        }
      });
    } catch (error) {
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    }
  },

  async doPay() {
    if (this.data.paying) return;
    const order = this.data.order;
    if (!order) return;

    wx.showModal({
      title: "确认支付",
      content: `支付 ¥${order.amount} 完成「${order.service_name}」预约？`,
      confirmText: "确认支付",
      confirmColor: "#18a67d",
      success: async ({ confirm }) => {
        if (!confirm) return;
        this.setData({ paying: true });
        wx.showLoading({ title: "支付中" });
        try {
          await request(`/me/appointments/${this.data.orderId}/pay`, {
            method: "POST",
            data: {}
          });
          wx.hideLoading();
          wx.showToast({ title: "支付成功", icon: "success" });
          setTimeout(() => wx.redirectTo({
            url: `/pages/order-detail/order-detail?id=${this.data.orderId}`
          }), 1500);
        } catch (error) {
          wx.hideLoading();
          this.setData({ paying: false });
          wx.showToast({ title: error.message || "支付失败", icon: "none" });
        }
      }
    });
  }
});
