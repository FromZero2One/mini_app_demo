/**
 * 云开发数据访问层
 *
 * 与 mock-api 提供完全相同的接口，页面只依赖 utils/data.js，
 * 不关心底层是云函数还是 HTTP。
 */
const { CLOUD_ENV } = require('./config');

/**
 * 调用云函数 articles
 * @param {string} action list / detail / seed / ping
 * @param {object} data   业务参数
 */
function invoke(action, data = {}) {
  return new Promise((resolve, reject) => {
    if (!wx.cloud) {
      reject(new Error('当前基础库不支持云开发，请升级微信版本'));
      return;
    }
    wx.cloud.callFunction({
      name: 'articles',
      data: Object.assign({ action }, data),
    })
      .then(res => {
        const body = res.result || {};
        if (body.code === 0) resolve(body.data);
        else reject(new Error(body.message || '云函数返回异常'));
      })
      .catch(err => {
        const msg = err.errMsg || err.message || '未知错误';
        reject(new Error(`云函数调用失败：${msg}（请确认已部署 articles 云函数，见 README「云开发模式」）`));
      });
  });
}

module.exports = {
  /** 文章列表：{ page, size, keyword } -> { list, total, hasMore, page, size } */
  getArticles: ({ page = 1, size = 5, keyword = '' } = {}) => invoke('list', { page, size, keyword }),

  /** 文章详情：id -> article */
  getArticle: id => invoke('detail', { id }),

  /** 健康检查 */
  checkHealth: () => invoke('ping'),

  /** 初始化示例数据（幂等：集合已有数据时跳过） */
  seed: () => invoke('seed'),

  /** 供页面展示 */
  ENV: CLOUD_ENV,
};
