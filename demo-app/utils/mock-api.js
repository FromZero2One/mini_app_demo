/**
 * 本地 Mock 数据访问层
 *
 * 与 cloud-api 提供完全相同的接口，页面只依赖 utils/data.js。
 */
const { request } = require('./request');

module.exports = {
  getArticles: ({ page = 1, size = 5, keyword = '' } = {}) =>
    request('/api/articles', { data: { page, size, keyword } }),

  getArticle: id => request(`/api/articles/${id}`),

  checkHealth: () => request('/api/health'),

  // 本地 mock 没有初始化概念，调用时给出明确提示
  seed: () => Promise.reject(new Error('mock 模式无需初始化数据，示例数据已内置在 mock-server/server.js')),

  ENV: 'mock',
};
