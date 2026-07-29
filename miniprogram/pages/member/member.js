const { request } = require("../../utils/request");

const LEVEL_CONFIG = {
  "青竹会员": { next: "银杉会员", nextPoints: 500 },
  "银杉会员": { next: "金桂会员", nextPoints: 1500 },
  "金桂会员": { next: null, nextPoints: 0 }
};

const BENEFITS = [
  "专属项目折扣 9.5 折",
  "生日月双倍积分",
  "优先预约热门时段",
  "不定期专属活动邀请",
  "健康档案云端存储"
];

Page({
  data: {
    user: null,
    levelConfig: {},
    benefits: []
  },

  onShow() {
    this.loadProfile();
  },

  async loadProfile() {
    try {
      const summary = await request("/profile/summary");
      const user = summary.user || {};
      const level = user.member_level || "青竹会员";
      const config = LEVEL_CONFIG[level] || { next: null, nextPoints: 0 };
      const progress = Math.min((user.points || 0) / config.nextPoints * 100, 100);
      this.setData({
        user: {
          ...user,
          progress,
          currentPoints: user.points || 0
        },
        levelConfig: config,
        benefits: BENEFITS
      });
    } catch (error) {
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    }
  },

  goCoupons() {
    wx.navigateTo({ url: "/pages/coupons/coupons" });
  }
});
