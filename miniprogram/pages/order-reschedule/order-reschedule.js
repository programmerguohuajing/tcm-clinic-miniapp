const { request } = require("../../utils/request");

Page({
  data: {
    orderId: null,
    order: null,
    date: "",
    slots: [],
    selectedSlot: null,
    loading: false
  },

  onLoad(options) {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    this.setData({
      orderId: Number(options.id),
      date: dateStr
    });
    this.loadOrder();
    this.loadSlots();
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

  async loadSlots() {
    this.setData({ loading: true, selectedSlot: null });
    try {
      const order = this.data.order;
      if (!order) return;
      const slots = await request(`/schedules?practitionerId=${order.practitioner_id}&date=${this.data.date}&storeId=${order.store_id || ''}`);
      const available = slots.filter((s) => s.available);
      this.setData({
        slots: available.map((s) => ({
          ...s,
          timeLabel: `${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}`
        }))
      });
    } catch (error) {
      wx.showToast({ title: error.message || "加载时段失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  selectSlot(event) {
    const slot = event.currentTarget.dataset.item;
    if (!slot.available) return;
    this.setData({ selectedSlot: slot });
  },

  onDateChange(event) {
    this.setData({ date: event.detail.value });
    this.loadSlots();
  },

  async confirmReschedule() {
    if (!this.data.selectedSlot) {
      wx.showToast({ title: "请选择新时段", icon: "none" });
      return;
    }
    wx.showModal({
      title: "确认改期",
      content: `将预约改为 ${this.data.date} ${this.data.selectedSlot.timeLabel}？`,
      confirmColor: "#18a67d",
      success: async ({ confirm }) => {
        if (!confirm) return;
        wx.showLoading({ title: "处理中" });
        try {
          await request(`/me/appointments/${this.data.orderId}/reschedule`, {
            method: "PATCH",
            data: { scheduleId: this.data.selectedSlot.id }
          });
          wx.hideLoading();
          wx.showToast({ title: "改期成功", icon: "success" });
          setTimeout(() => wx.redirectTo({
            url: `/pages/order-detail/order-detail?id=${this.data.orderId}`
          }), 1200);
        } catch (error) {
          wx.hideLoading();
          wx.showToast({ title: error.message || "改期失败", icon: "none" });
        }
      }
    });
  }
});
