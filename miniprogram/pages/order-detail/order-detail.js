const { request } = require("../../utils/request");
const { STATUS_TEXT, PAYMENT_STATUS_TEXT } = require("../../utils/constants");

Page({
  data: {
    loading: true,
    orderId: null,
    order: null,
    actions: []
  },

  onLoad(options) {
    this.setData({ orderId: Number(options.id) });
    this.loadOrder();
  },

  onShow() {
    if (this.data.orderId) this.loadOrder();
  },

  async loadOrder() {
    this.setData({ loading: true });
    try {
      const order = await request(`/me/appointments/${this.data.orderId}`);
      const actions = this.buildActions(order);
      this.setData({
        loading: false,
        order: {
          ...order,
          statusText: STATUS_TEXT[order.status] || order.status,
          paymentText: PAYMENT_STATUS_TEXT[order.payment_status] || order.payment_status,
          startLabel: order.start_time.slice(0, 5),
          endLabel: order.end_time.slice(0, 5),
          practitioner_initial: (order.practitioner_name || "师").slice(0, 1)
        },
        actions
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    }
  },

  buildActions(order) {
    const actions = [];
    if (order.status === "pending") {
      actions.push({ key: "pay", label: "去支付" });
      actions.push({ key: "cancel", label: "取消预约", danger: true });
    } else if (order.status === "confirmed") {
      if (order.payment_status === "unpaid") {
        actions.push({ key: "pay", label: "去支付" });
      }
      actions.push({ key: "cancel", label: "取消预约", danger: true });
      actions.push({ key: "reschedule", label: "改期" });
    } else if (order.status === "completed") {
      actions.push({ key: "review", label: "评价服务" });
    }
    return actions;
  },

  onActionTap(event) {
    const key = event.currentTarget.dataset.key;
    const order = this.data.order;
    if (key === "cancel") {
      wx.navigateTo({ url: `/pages/order-cancel/order-cancel?id=${order.id}` });
    } else if (key === "pay") {
      wx.navigateTo({ url: `/pages/order-pay/order-pay?id=${order.id}` });
    } else if (key === "review") {
      wx.navigateTo({ url: `/pages/order-review/order-review?id=${order.id}` });
    } else if (key === "reschedule") {
      wx.navigateTo({ url: `/pages/order-reschedule/order-reschedule?id=${order.id}` });
    }
  },

  callPhone() {
    const phone = this.data.order?.store_phone;
    if (!phone) return;
    wx.makePhoneCall({ phoneNumber: phone });
  },

  goBack() {
    wx.navigateBack();
  }
});
