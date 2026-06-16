const { request } = require("../../utils/request");

Page({
  data: {
    summary: {
      profile: { name: "技师", title: "中医调理师", store_name: "" },
      cards: { todayAppointments: 0, futureSchedules: 0, grossAmount: "0.00", commissionAmount: "0.00" }
    },
    appointments: [],
    statusText: {
      pending: "待确认",
      confirmed: "已确认",
      completed: "已完成",
      cancelled: "已取消",
      refunded: "已退款"
    }
  },

  onShow() {
    this.loadTechnician();
  },

  async loadTechnician() {
    try {
      const [summary, appointments] = await Promise.all([
        request("/technician/me/summary"),
        request("/technician/me/appointments")
      ]);
      this.setData({
        summary: {
          ...this.data.summary,
          ...summary,
          cards: {
            ...this.data.summary.cards,
            ...(summary.cards || {})
          }
        },
        appointments: appointments.slice(0, 5).map((item) => ({
          ...item,
          startLabel: item.start_time.slice(0, 5)
        }))
      });
    } catch (error) {
      if (error.statusCode === 403) {
        wx.showToast({ title: "暂无技师端权限", icon: "none" });
        setTimeout(() => wx.navigateBack(), 800);
        return;
      }
      wx.showToast({ title: error.message || "技师端加载失败", icon: "none" });
    }
  },

  goSchedules() {
    wx.navigateTo({ url: "/pages/technician-schedules/technician-schedules" });
  },

  goCommissions() {
    wx.navigateTo({ url: "/pages/technician-commissions/technician-commissions" });
  }
});
