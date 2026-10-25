const dataApi = require('../../utils/data');

const PAGE_SIZE = 5; // 每页条数，与 mock 服务端保持一致

Page({
  data: {
    articles: [],  // 文章列表
    loading: false,
    error: '',
    page: 1,
    hasMore: false,
  },

  onLoad() {
    this.reload();
  },

  /** 下拉刷新（list.json 里开启了 enablePullDownRefresh） */
  onPullDownRefresh() {
    this.reload(true);
  },

  /** 上拉触底加载下一页 */
  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return;
    this.loadPage(this.data.page + 1);
  },

  /** 重新从第 1 页加载 */
  reload(stopPull = false) {
    this.setData({ page: 1, articles: [], error: '' });
    this.loadPage(1, stopPull);
  },

  loadPage(page, stopPull = false) {
    this.setData({ loading: true });
    dataApi.getArticles({ page, size: PAGE_SIZE })
      .then(data => {
        this.setData({
          articles: page === 1 ? data.list : this.data.articles.concat(data.list),
          page,
          hasMore: data.hasMore,
        });
      })
      .catch(err => this.setData({ error: err.message }))
      .finally(() => {
        this.setData({ loading: false });
        if (stopPull) wx.stopPullDownRefresh();
      });
  },

  /** 点击卡片进入详情，通过 url 传文章 id */
  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },
});
