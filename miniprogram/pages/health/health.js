const { request } = require("../../utils/request");

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
    records: fallbackRecords,
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
      console.warn("健康档案加载失败", error);
      this.setData({ records: fallbackRecords });
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
      const localRecord = {
        id: Date.now(),
        constitution,
        symptoms: symptomsText.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
        pulse_note: pulseNote,
        diagnosis_note: "本地演示记录，接口恢复后可保存到数据库。",
        created_at: new Date().toISOString(),
        dateLabel: new Date().toISOString().slice(0, 10)
      };
      this.setData({
        records: [localRecord, ...this.data.records],
        form: { constitution: "", symptomsText: "", pulseNote: "" }
      });
      wx.showToast({ title: "已保存演示档案", icon: "none" });
    }
  }
});
