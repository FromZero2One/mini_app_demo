// 「小记」Demo —— 应用入口
App({
  onLaunch() {
    // 应用启动时触发一次：适合做初始化，例如读取缓存、检查更新
    console.log('[小记] 启动于', new Date().toLocaleString());
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
