/**
 * 数据访问统一入口
 *
 * 页面只需要 require('../../utils/data')；
 * 底层是云开发还是本地 mock，由 utils/config.js 的 DATA_SOURCE 决定。
 * 切换数据源时页面代码零改动。
 */
const { DATA_SOURCE } = require('./config');

const api = DATA_SOURCE === 'cloud'
  ? require('./cloud-api')
  : require('./mock-api');

module.exports = api;
