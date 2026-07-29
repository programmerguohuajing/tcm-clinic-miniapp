const { request } = require("../../utils/request");

Page({
  data: {
    version: "1.0.0"
  },

  onShareAppMessage() {
    return {
      title: "来青囊中医馆做一次节气调理",
      path: "/pages/home/home"
    };
  },

  clearCache() {
    wx.showModal({
      title: "清除缓存",
      content: "将清除本地缓存数据（不包括登录态）",
      success: ({ confirm }) => {
        if (!confirm) return;
        wx.clearStorage({ success: () => {
          wx.showToast({ title: "缓存已清除", icon: "success" });
        }});
      }
    });
  },

  async logout() {
    wx.showModal({
      title: "退出登录",
      content: "确定要退出当前账号吗？",
      confirmColor: "#c0392b",
      success: async ({ confirm }) => {
        if (!confirm) return;
        try {
          const { clearToken } = require("../../utils/auth");
          clearToken();
          wx.showToast({ title: "已退出", icon: "success" });
          setTimeout(() => wx.reLaunch({ url: "/pages/home/home" }), 1200);
        } catch (error) {
          wx.showToast({ title: "退出失败", icon: "none" });
        }
      }
    });
  }
});
