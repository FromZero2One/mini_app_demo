/**
 * 网络请求封装（演示项目最佳实践）
 *
 * - 统一 baseUrl：切换环境只改这一个地方
 * - Promise 化 wx.request：页面里可以链式调用
 * - 统一业务码处理：code !== 0 视为失败
 */
/**
 * Mock 服务地址：
 * - 开发者工具模拟器里 127.0.0.1 也能用，但统一走局域网 IP，真机/模拟器一份配置
 * - 真机预览必须用电脑的局域网 IP（已按当前网络预置 192.168.31.56）
 * - 电脑 IP 变了（换了 Wi-Fi/重新拨号）要同步更新这里，用 ipconfig 查看
 */
const BASE_URL = 'http://192.168.31.56:3001';

function request(path, options = {}) {
  const { method = 'GET', data, timeout = 5000 } = options;

  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + path,
      method,
      data,
      timeout,
      success(res) {
        if (res.statusCode !== 200 || !res.data || res.data.code !== 0) {
          const message = (res.data && res.data.message) || `请求失败(${res.statusCode})`;
          reject(new Error(message));
          return;
        }
        resolve(res.data.data);
      },
      fail(err) {
        reject(new Error('网络异常，请确认 mock 服务已启动：' + (err.errMsg || '')));
      },
    });
  });
}

module.exports = { request, BASE_URL };
