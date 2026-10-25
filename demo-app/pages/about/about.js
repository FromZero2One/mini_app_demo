const { BASE_URL } = require('../../utils/request');

Page({
  data: {
    baseUrl: BASE_URL,
    info: [],  // 运行环境信息 [{k, v}]
  },

  onLoad() {
    this.loadInfo();
  },

  /**
   * 读取系统信息
   * 优先使用新 API（基础库 >= 2.20.1），失败则回退旧接口
   */
  loadInfo() {
    let items;
    try {
      const device = wx.getDeviceInfo();
      const window = wx.getWindowInfo();
      const app = wx.getAppBaseInfo();
      items = [
        { k: '机型', v: device.model },
        { k: '系统', v: device.system },
        { k: '微信版本', v: app.version },
        { k: '基础库版本', v: app.SDKVersion },
        { k: '屏幕', v: `${window.screenWidth} x ${window.screenHeight} px` },
        { k: '像素比', v: String(window.pixelRatio) },
      ];
    } catch (e) {
      const s = wx.getSystemInfoSync();
      items = [
        { k: '机型', v: s.model },
        { k: '系统', v: s.system },
        { k: '微信版本', v: s.version },
        { k: '基础库版本', v: s.SDKVersion },
        { k: '屏幕', v: `${s.screenWidth} x ${s.screenHeight} px` },
        { k: '像素比', v: String(s.pixelRatio) },
      ];
    }
    this.setData({ info: items });
  },

  /** 复制 Mock 服务地址到剪贴板 */
  copyUrl() {
    wx.setClipboardData({
      data: this.data.baseUrl,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },
});
