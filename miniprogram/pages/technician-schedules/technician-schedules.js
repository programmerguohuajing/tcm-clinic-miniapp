const { request } = require("../../utils/request");

function today(offset = 0) {
  const date = new Date(Date.now() + offset * 86400000);
  return date.toISOString().slice(0, 10);
}

Page({
  data: {
    schedules: [],
    form: {
      workDate: today(),
      startTime: "09:30",
      endTime: "10:30",
      capacity: 1,
      status: "open"
    },
    statusText: {
      open: "开放预约",
      closed: "已关闭"
    },
    saving: false
  },

  onShow() {
    this.loadSchedules();
  },

  async loadSchedules() {
    try {
      const schedules = await request("/technician/me/schedules");
      this.setData({
        schedules: schedules.map((item) => ({
          ...item,
          startLabel: item.start_time.slice(0, 5),
          endLabel: item.end_time.slice(0, 5)
        }))
      });
    } catch (error) {
      wx.showToast({ title: error.message || "排班加载失败", icon: "none" });
    }
  },

  updateField(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  switchStatus(event) {
    this.setData({ "form.status": event.detail.value ? "open" : "closed" });
  },

  async saveSchedule() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      await request("/technician/me/schedules", {
        method: "POST",
        data: {
          ...this.data.form,
          capacity: Number(this.data.form.capacity || 1)
        }
      });
      wx.showToast({ title: "排班已保存" });
      this.loadSchedules();
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  }
});
