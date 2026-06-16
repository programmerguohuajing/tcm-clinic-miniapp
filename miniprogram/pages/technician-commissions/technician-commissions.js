const { request } = require("../../utils/request");

Page({
  data: {
    summary: { grossAmount: "0.00", commissionAmount: "0.00" },
    rows: []
  },

  onShow() {
    this.loadCommissions();
  },

  async loadCommissions() {
    try {
      const data = await request("/technician/me/commissions");
      this.setData({
        summary: data.summary || this.data.summary,
        rows: (data.rows || []).map((item) => ({
          ...item,
          startLabel: item.start_time.slice(0, 5),
          rateLabel: `${Math.round(Number(item.rate || 0) * 100)}%`
        }))
      });
    } catch (error) {
      wx.showToast({ title: error.message || "提成加载失败", icon: "none" });
    }
  }
});
