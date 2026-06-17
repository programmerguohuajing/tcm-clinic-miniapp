const { request } = require("../../utils/request");
const { isDev } = require("../../utils/env");

const fallbackRecords = [
  {
    id: 1,
    constitution: "气虚夹湿",
    symptoms: ["易困倦", "饭后腹胀", "手脚偏凉"],
    pulse_note: "脉象偏缓，需线下复核。",
    diagnosis_note: "建议先做 2 周健脾祛湿调理，配合早睡与轻运动。",
    created_at: "2026-06-12T00:00:00.000Z",
    dateLabel: "2026-06-12"
  }
];

Page({
  data: {
    records: isDev() ? fallbackRecords : [],
    form: {
      constitution: "",
      symptomsText: "",
      pulseNote: ""
    }
  },

  onShow() {
    this.loadRecords();
  },

  async loadRecords() {
    try {
      const records = await request("/health-records");
      this.setData({
        records: records.map((item) => ({
          ...item,
          dateLabel: item.created_at.slice(0, 10)
        }))
      });
    } catch (error) {
      if (isDev()) {
        this.setData({ records: fallbackRecords });
      } else {
        wx.showToast({ title: error.message || "加载失败", icon: "none" });
      }
    }
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  async submit() {
    const { constitution, symptomsText, pulseNote } = this.data.form;
    if (!constitution) {
      wx.showToast({ title: "请填写体质结论", icon: "none" });
      return;
    }

    try {
      await request("/health-records", {
        method: "POST",
        data: {
          constitution,
          symptoms: symptomsText.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
          pulseNote,
          diagnosisNote: "由用户端记录，待技师复核。"
        }
      });
      this.setData({ form: { constitution: "", symptomsText: "", pulseNote: "" } });
      wx.showToast({ title: "已保存" });
      this.loadRecords();
    } catch (error) {
      if (isDev()) {
        const localRecord = {
          id: Date.now(),
          constitution,
          symptoms: symptomsText.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
          pulse_note: pulseNote,
          diagnosis_note: "本地演示记录",
          created_at: new Date().toISOString(),
          dateLabel: new Date().toISOString().slice(0, 10)
        };
        this.setData({
          records: [localRecord, ...this.data.records],
          form: { constitution: "", symptomsText: "", pulseNote: "" }
        });
        wx.showToast({ title: "已保存演示档案", icon: "none" });
      } else {
        wx.showToast({ title: error.message || "保存失败", icon: "none" });
      }
    }
  },

  deleteRecord(event) {
    const id = Number(event.currentTarget.dataset.id);
    if (!id) return;

    wx.showModal({
      title: "删除档案",
      content: "确认删除这条疗愈档案吗？",
      confirmText: "删除",
      confirmColor: "#b42318",
      success: async ({ confirm }) => {
        if (!confirm) return;
        try {
          await request(`/health-records/${id}`, { method: "DELETE" });
          this.setData({ records: this.data.records.filter((item) => Number(item.id) !== id) });
          wx.showToast({ title: "已删除" });
        } catch (error) {
          if (!isDev()) {
            wx.showToast({ title: error.message || "删除失败", icon: "none" });
          } else {
            this.setData({ records: this.data.records.filter((item) => Number(item.id) !== id) });
            wx.showToast({ title: "已从本地移除", icon: "none" });
          }
        }
      }
    });
  }
});
