const { DATA_SOURCE, MODE_LABEL, CLOUD_ENV, MOCK_BASE_URL } = require('../../utils/config');
const dataApi = require('../../utils/data');

const ENDPOINT = DATA_SOURCE === 'cloud' ? CLOUD_ENV : MOCK_BASE_URL;

Page({
  data: {
    modeLabel: MODE_LABEL,
    endpoint: ENDPOINT,
    isCloud: DATA_SOURCE === 'cloud',
    seeding: false,
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

  /** 复制数据源标识（云环境 ID 或 mock 地址） */
  copyEndpoint() {
    wx.setClipboardData({
      data: this.data.endpoint,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },

  /** 初始化云数据库示例数据（仅云开发模式，首次部署云函数后点一次） */
  seedData() {
    if (this.data.seeding) return;
    this.setData({ seeding: true });
    dataApi.seed()
      .then(r => {
        wx.showModal({
          title: r.seeded ? '初始化完成' : '无需初始化',
          content: r.seeded ? `已写入 ${r.inserted} 条示例数据` : `集合已有 ${r.total} 条数据，未重复写入`,
          showCancel: false,
        });
      })
      .catch(err => {
        wx.showModal({ title: '初始化失败', content: err.message, showCancel: false });
      })
      .finally(() => this.setData({ seeding: false }));
  },
});
