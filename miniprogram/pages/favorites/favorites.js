const { request } = require("../../utils/request");

Page({
  data: {
    favorites: [],
    tab: "store",
    tabs: [
      { key: "store", label: "门店" },
      { key: "practitioner", label: "技师" }
    ],
    filteredFavorites: []
  },

  onShow() {
    this.loadFavorites();
  },

  async loadFavorites() {
    try {
      const favorites = await request("/me/favorites");
      this.applyFilter(favorites, this.data.tab);
    } catch (error) {
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    }
  },

  applyFilter(favorites, tab) {
    const filtered = favorites.filter((f) => f.target_type === (tab || this.data.tab));
    this.setData({ favorites, filteredFavorites: filtered });
  },

  switchTab(event) {
    const tab = event.currentTarget.dataset.tab;
    this.applyFilter(this.data.favorites, tab);
    this.setData({ tab });
  },

  async removeFavorite(event) {
    const id = event.currentTarget.dataset.id;
    wx.showModal({
      title: "取消收藏",
      confirmColor: "#c0392b",
      success: async ({ confirm }) => {
        if (!confirm) return;
        try {
          await request(`/me/favorites/${id}`, { method: "DELETE" });
          wx.showToast({ title: "已取消收藏", icon: "success" });
          this.loadFavorites();
        } catch (error) {
          wx.showToast({ title: error.message || "操作失败", icon: "none" });
        }
      }
    });
  },

  goStoreDetail(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/store-detail/store-detail?id=${id}` });
  }
});
