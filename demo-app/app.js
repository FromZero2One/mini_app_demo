// 「小记」Demo —— 应用入口
const { DATA_SOURCE, CLOUD_ENV } = require('./utils/config');

App({
  onLaunch() {
    // 应用启动时触发一次：适合做初始化，例如云开发环境、读取缓存、检查更新
    console.log('[小记] 启动于', new Date().toLocaleString(), '| 数据源:', DATA_SOURCE);

    if (DATA_SOURCE === 'cloud') {
      if (!wx.cloud) {
        console.error('[小记] 当前基础库不支持云开发，请升级微信或把 utils/config.js 的 DATA_SOURCE 改为 mock');
      } else {
        wx.cloud.init({ env: CLOUD_ENV, traceUser: true });
        console.log('[小记] 云开发已初始化，env =', CLOUD_ENV);
      }
    }
  },

  onShow() {
    // 小程序从后台进入前台时触发
  },

  onHide() {
    // 小程序进入后台时触发
  },

  globalData: {
    // 跨页面共享的全局数据可以放在这里
    version: '1.0.0',
  },
});
