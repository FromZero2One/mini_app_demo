/**
 * 全局配置：数据源与环境
 *
 * DATA_SOURCE:
 *   'cloud' —— 微信云开发（云函数 + 云数据库），真机/体验版无需电脑
 *   'mock'  —— 本地 mock-server（离线开发、无云环境时使用）
 *
 * 切换方式：改这一行，重新编译即可，页面代码无需改动。
 */
const DATA_SOURCE = 'cloud';

const CLOUD_ENV = 'cloud1-d8g774cfa69b034d6';
const MOCK_BASE_URL = 'http://192.168.31.56:3001';

module.exports = {
  DATA_SOURCE,
  CLOUD_ENV,
  MOCK_BASE_URL,
  MODE_LABEL: DATA_SOURCE === 'cloud' ? '云开发' : '本地 Mock',
};
