const { request } = require('../../utils/request');

Page({
  data: {
    article: null,     // 文章详情
    paragraphs: [],    // 正文按空行拆成段
    loading: true,
    error: '',
  },

  onLoad(options) {
    // 从 url 取参数：/pages/detail/detail?id=3
    this.id = Number(options.id || 0);
    this.fetch();
  },

  fetch() {
    this.setData({ loading: true, error: '' });
    request(`/api/articles/${this.id}`)
      .then(article => {
        // 动态设置导航栏标题为文章标题
        wx.setNavigationBarTitle({ title: article.title });
        this.setData({
          article,
          paragraphs: article.content.split('\n\n'),
        });
      })
      .catch(err => this.setData({ error: err.message }))
      .finally(() => this.setData({ loading: false }));
  },

  retry() {
    this.fetch();
  },
});
