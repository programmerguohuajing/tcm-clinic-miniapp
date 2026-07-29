const { request } = require("../../utils/request");
const { MESSAGE_TYPE_TEXT } = require("../../utils/constants");

Page({
  data: { messages: [], refreshing: false },

  onShow() {
    this.loadMessages();
  },

  async loadMessages() {
    this.setData({ refreshing: true });
    try {
      const messages = await request("/me/messages");
      this.setData({
        messages: messages.map((m) => ({
          ...m,
          timeLabel: m.created_at ? m.created_at.slice(5, 10) + " " + m.created_at.slice(11, 16) : "",
          typeText: MESSAGE_TYPE_TEXT[m.type] || m.type,
          unread: !m.is_read
        }))
      });
    } catch (error) {
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    } finally {
      this.setData({ refreshing: false });
    }
  },

  async onPullDownRefresh() {
    await this.loadMessages();
    wx.stopPullDownRefresh();
  },

  async onMessageTap(event) {
    const id = Number(event.currentTarget.dataset.id);
    const messages = this.data.messages;
    const msg = messages.find((m) => m.id === id);
    if (!msg) return;

    try {
      await request(`/me/messages/${id}/read`, { method: "PATCH" });
    } catch (_) {}

    const relatedId = msg.related_id;
    if (msg.type === "payment_success" || msg.type === "appointment_confirmed") {
      if (relatedId) wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${relatedId}` });
    } else if (msg.type === "review_reply") {
      wx.showToast({ title: msg.body, icon: "none", duration: 3000 });
    }
  }
});
