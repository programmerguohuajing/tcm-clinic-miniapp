const { request } = require("../../utils/request");

Page({
  data: {
    summary: {
      user: { nickname: "体验用户", initial: "体", member_level: "青竹会员", points: 0 },
      stats: { appointments: 0, coupons: 0, familyMembers: 0 }
    },
    canManage: false,
    canTechnician: false,
    appointments: [],
    familyMembers: [],
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
        canTechnician: Boolean(summary.user && summary.user.can_technician),
        appointments: appointments.slice(0, 5).map((item) => ({
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

  goTechnician() {
    if (!this.data.canTechnician) {
      wx.showToast({ title: "暂无技师端权限", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/technician/technician" });
  },

  goOrderDetail(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${id}` });
  },

  goMessages() {
    wx.navigateTo({ url: "/pages/messages/messages" });
  },

  goCoupons() {
    wx.navigateTo({ url: "/pages/coupons/coupons" });
  },

  goMember() {
    wx.navigateTo({ url: "/pages/member/member" });
  },

  goSettings() {
    wx.navigateTo({ url: "/pages/settings/settings" });
  },

  goFavorites() {
    wx.navigateTo({ url: "/pages/favorites/favorites" });
  },

  onShareAppMessage() {
    return {
      title: "来青囊中医馆做一次节气调理",
      path: "/pages/home/home?invite=demo"
    };
  }
});
