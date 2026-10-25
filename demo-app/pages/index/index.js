const { request, BASE_URL } = require('../../utils/request');

Page({
  data: {
    greeting: '',
    baseUrl: BASE_URL,
    apiOk: false,
    apiChecked: false,
    checking: false,
  },

  onLoad() {
    // 按时段问候
    const hour = new Date().getHours();
    const greeting =
      hour < 6 ? '夜深了' :
      hour < 12 ? '早上好' :
      hour < 14 ? '中午好' :
      hour < 18 ? '下午好' : '晚上好';
    this.setData({ greeting });
  },

  onShow() {
    // 每次切到首页时自动检测一次 mock 服务
    this.checkApi();
  },

  checkApi() {
    this.setData({ checking: true });
    request('/api/health')
      .then(() => this.setData({ apiOk: true, apiChecked: true }))
      .catch(() => this.setData({ apiOk: false, apiChecked: true }))
      .finally(() => this.setData({ checking: false }));
  },

  goList() {
    // tabBar 页面只能用 switchTab 跳转
    wx.switchTab({ url: '/pages/list/list' });
  },

  goAbout() {
    wx.switchTab({ url: '/pages/about/about' });
  },
});
