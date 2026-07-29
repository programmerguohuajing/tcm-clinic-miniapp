const { request } = require("../../utils/request");

Page({
  data: { article: null, articleId: null },

  onLoad(options) {
    const id = Number(options.id);
    if (!id) {
      wx.showToast({ title: "参数错误", icon: "none" });
      return;
    }
    this.setData({ articleId: id });
    this.loadArticle(id);
  },

  async loadArticle(id) {
    try {
      const article = await request(`/articles/${id}`);
      this.setData({ article });
      wx.setNavigationBarTitle({ title: article.title });
    } catch (error) {
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    }
  },

  onShareAppMessage() {
    const article = this.data.article;
    return {
      title: article?.title || "疗愈札记",
      path: `/pages/article-detail/article-detail?id=${this.data.articleId || ''}`
    };
  }
});
