const { request } = require("../../utils/request");
const { isDev } = require("../../utils/env");
const mock = require("../../utils/mock-data");

function today() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

Page({
  data: {
    date: today(),
    services: [],
    practitioners: [],
    slots: [],
    selectedService: null,
    selectedPractitioner: null,
    selectedSlot: null
  },

  onLoad() {
    this.loadServices();
  },

  async loadServices() {
    try {
      const storeId = getApp().globalData.storeId;
      const services = await request(`/services${storeId ? `?storeId=${storeId}` : ""}`);
      this.setData({ services });
      if (services[0]) this.selectService({ currentTarget: { dataset: { item: services[0] } } });
    } catch (error) {
      if (isDev()) {
        wx.showToast({ title: "接口失败，使用演示项目", icon: "none" });
        this.setData({ services: mock.services });
        if (mock.services[0]) this.selectService({ currentTarget: { dataset: { item: mock.services[0] } } });
      } else {
        wx.showToast({ title: error.message || "加载失败", icon: "none" });
      }
    }
  },

  async selectService(event) {
    const selectedService = event.currentTarget.dataset.item;
    this.setData({ selectedService, selectedPractitioner: null, selectedSlot: null, slots: [] });
    try {
      const storeId = getApp().globalData.storeId;
      const practitioners = await request(`/practitioners?serviceId=${selectedService.id}${storeId ? `&storeId=${storeId}` : ""}`);
      this.setData({ practitioners });
      if (practitioners[0]) this.selectPractitioner({ currentTarget: { dataset: { item: practitioners[0] } } });
    } catch (error) {
      if (isDev()) {
        this.setData({ practitioners: mock.practitioners });
        if (mock.practitioners[0]) this.selectPractitioner({ currentTarget: { dataset: { item: mock.practitioners[0] } } });
      } else {
        wx.showToast({ title: error.message || "加载失败", icon: "none" });
      }
    }
  },

  async selectPractitioner(event) {
    const selectedPractitioner = event.currentTarget.dataset.item;
    this.setData({ selectedPractitioner, selectedSlot: null });
    try {
      const storeId = getApp().globalData.storeId;
      const slots = await request(`/schedules?practitionerId=${selectedPractitioner.id}&date=${this.data.date}${storeId ? `&storeId=${storeId}` : ""}`);
      this.setData({
        slots: slots.map((slot) => ({
          ...slot,
          timeLabel: `${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)}`
        }))
      });
    } catch (error) {
      if (isDev()) {
        this.setData({ slots: mock.slots });
      } else {
        wx.showToast({ title: error.message || "加载失败", icon: "none" });
      }
    }
  },

  selectSlot(event) {
    const selectedSlot = event.currentTarget.dataset.item;
    if (!selectedSlot.available) return;
    this.setData({ selectedSlot });
  },

  async submit() {
    const { selectedService, selectedPractitioner, selectedSlot } = this.data;
    if (!selectedService || !selectedPractitioner || !selectedSlot) {
      wx.showToast({ title: "请先选好项目、技师和时间", icon: "none" });
      return;
    }

    try {
      const appointment = await request("/appointments", {
        method: "POST",
        data: {
          practitionerId: Number(selectedPractitioner.id),
          serviceId: Number(selectedService.id),
          scheduleId: Number(selectedSlot.id),
          note: ""
        }
      });
      wx.redirectTo({
        url: `/pages/order-detail/order-detail?id=${appointment.id}&from=booking`
      });
    } catch (error) {
      if (isDev()) {
        wx.showToast({ title: "接口失败，展示演示订单", icon: "none" });
        wx.navigateTo({
          url: `/pages/appointment-confirm/appointment-confirm?orderNo=DEMO${Date.now()}`
        });
      } else {
        wx.showToast({ title: error.message || "预约失败", icon: "none" });
      }
    }
  }
});
