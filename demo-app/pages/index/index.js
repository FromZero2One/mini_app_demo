const { DATA_SOURCE, MODE_LABEL, CLOUD_ENV, MOCK_BASE_URL } = require('../../utils/config');
const dataApi = require('../../utils/data');

// 当前数据源的地址（云开发显示环境 ID，mock 显示服务地址）
const ENDPOINT = DATA_SOURCE === 'cloud' ? CLOUD_ENV : MOCK_BASE_URL;

Page({
  data: {
    greeting: '',
    modeLabel: MODE_LABEL,
    endpoint: ENDPOINT,
    isCloud: DATA_SOURCE === 'cloud',
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
    // 每次切到首页时自动检测一次数据源
    this.checkApi();
  },

  checkApi() {
    this.setData({ checking: true });
    dataApi.checkHealth()
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

  goGame() {
    wx.navigateTo({ url: '/pages/game/game' });
  },
});
