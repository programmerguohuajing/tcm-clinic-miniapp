const { request } = require("../../utils/request");

Page({
  data: {
    dashboard: {
      cards: { revenue: "0.00", orders: 0, practitioners: 0, users: 0 },
      trend: []
    },
    completingId: null,
    orders: [
      {
        id: 1,
        service_name: "节气扶阳艾灸",
        user_name: "林青禾",
        practitioner_name: "许安和",
        appointment_date: "2026-06-12",
        startLabel: "09:30",
        status: "pending"
      }
    ],
    statusText: {
      pending: "待确认",
      confirmed: "已确认",
      completed: "已完成",
      cancelled: "已取消",
      refunded: "已退款"
    }
  },

  onShow() {
    this.loadAdmin();
  },

  async loadAdmin() {
    try {
      const [dashboard, orders] = await Promise.all([
        request("/admin/dashboard"),
        request("/admin/orders")
      ]);
      this.setData({
        dashboard: {
          ...dashboard,
          cards: {
            revenue: dashboard.cards && dashboard.cards.revenue ? dashboard.cards.revenue : "0.00",
            orders: dashboard.cards && dashboard.cards.orders ? dashboard.cards.orders : 0,
            practitioners: dashboard.cards && dashboard.cards.practitioners ? dashboard.cards.practitioners : 0,
            users: dashboard.cards && dashboard.cards.users ? dashboard.cards.users : 0
          }
        },
        orders: orders.map((item) => ({
          ...item,
          startLabel: item.start_time.slice(0, 5)
        }))
      });
    } catch (error) {
      if (error.statusCode === 403) {
        wx.showToast({ title: "暂无管理端权限", icon: "none" });
        setTimeout(() => wx.navigateBack(), 800);
        return;
      }

      wx.showToast({ title: "接口失败，使用演示看板", icon: "none" });
    }
  },

  async completeOrder(event) {
    const id = event.currentTarget.dataset.id;
    if (this.data.completingId) return;
    this.setData({ completingId: id });
    try {
      await request(`/admin/orders/${id}/status`, {
        method: "PATCH",
        data: { status: "completed" }
      });
      wx.showToast({ title: "已核销" });
      this.loadAdmin();
    } catch (error) {
      wx.showToast({ title: error.message || "核销失败", icon: "none" });
    } finally {
      this.setData({ completingId: null });
    }
  }
});
