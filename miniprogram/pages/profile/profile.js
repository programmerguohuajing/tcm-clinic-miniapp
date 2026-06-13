const { request } = require("../../utils/request");

Page({
  data: {
    summary: {
      user: { nickname: "体验用户", initial: "体", member_level: "青竹会员", points: 0 },
      stats: { appointments: 0, coupons: 0, familyMembers: 0 }
    },
    canManage: false,
    appointments: [
      {
        id: 1,
        service_name: "节气扶阳艾灸",
        practitioner_name: "许安和",
        appointment_date: "2026-06-12",
        startLabel: "09:30",
        status: "pending",
        amount: "168.00"
      }
    ],
    familyMembers: [
      { id: 1, name: "林奶奶", relation: "祖母" },
      { id: 2, name: "小满", relation: "孩子" }
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
    this.loadProfile();
  },

  async loadProfile() {
    try {
      const [summary, appointments, familyMembers] = await Promise.all([
        request("/profile/summary"),
        request("/me/appointments"),
        request("/family-members")
      ]);
      this.setData({
        summary: {
          ...summary,
          user: {
            ...summary.user,
            initial: (summary.user.nickname || "体").slice(0, 1)
          }
        },
        canManage: Boolean(summary.user && summary.user.can_manage),
        appointments: appointments.map((item) => ({
          ...item,
          startLabel: item.start_time.slice(0, 5)
        })),
        familyMembers
      });
    } catch (error) {
      console.warn("个人中心加载失败", error);
      wx.showToast({ title: "接口失败，使用演示资料", icon: "none" });
    }
  },

  goAdmin() {
    if (!this.data.canManage) {
      wx.showToast({ title: "暂无管理端权限", icon: "none" });
      return;
    }

    wx.navigateTo({ url: "/pages/admin/admin" });
  },

  onShareAppMessage() {
    return {
      title: "来青囊中医馆做一次节气调理",
      path: "/pages/home/home?invite=demo"
    };
  }
});
