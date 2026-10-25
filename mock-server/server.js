/**
 * 本地 Mock API 服务器（零依赖，仅用 Node 内置模块）
 *
 * 启动：npm start（或 node server.js）
 * 端口：3001（可用环境变量 PORT 覆盖）
 * 监听：0.0.0.0 —— 允许同一局域网的手机（真机预览）访问
 *
 * 接口：
 *   GET /api/health         健康检查
 *   GET /api/articles       文章列表，支持 page / size / keyword 参数
 *   GET /api/articles/:id   文章详情（不存在返回 404）
 *
 * 统一返回格式：{ code, message, data }
 *   code = 0 表示成功，非 0 表示业务错误
 */
const http = require('http');
const os = require('os');

const PORT = Number(process.env.PORT) || 3001;

/** 取电脑局域网 IPv4（跳过 WSL/Hyper-V 等虚拟网卡），用于真机预览提示 */
function lanIP() {
  const ifaces = os.networkInterfaces();
  const isPhysical = name => /wlan|wi-?fi|以太网|ethernet/i.test(name) && !/vethernet|virtual|hyper|wsl/i.test(name);
  // 优先物理网卡
  for (const [name, list] of Object.entries(ifaces)) {
    if (!isPhysical(name)) continue;
    for (const it of list) {
      if (it.family === 'IPv4' && !it.internal) return it.address;
    }
  }
  // 兜底：第一个非内部 IPv4
  for (const list of Object.values(ifaces)) {
    for (const it of list) {
      if (it.family === 'IPv4' && !it.internal) return it.address;
    }
  }
  return '127.0.0.1';
}

/** 内置文章数据 */
const articles = [
  {
    id: 1,
    title: '小程序项目结构速览',
    author: '小记',
    date: '2026-10-20',
    summary: '一个原生小程序由哪些文件组成？app.json 和页面四件套各自负责什么？',
    content: '一个原生微信小程序最核心的全局文件是 app.json、app.js、app.wxss。\n\napp.json 是全局配置：注册页面路径、设置窗口样式、配置 tabBar。pages 数组的第一项就是小程序的启动首页。\n\n每个页面由四个同名文件组成：.wxml 负责结构，.wxss 负责样式，.js 负责逻辑，.json 负责页面级配置。\n\nproject.config.json 保存项目配置，比如 appid、编译选项。导入微信开发者工具时会自动读取，本项目已预置「不校验合法域名」，可直接请求本地 mock 服务。'
  },
  {
    id: 2,
    title: 'WXML 数据绑定入门',
    author: '小记',
    date: '2026-10-19',
    summary: 'Mustache 语法、列表渲染 wx:for、条件渲染 wx:if，是小程序 UI 的三块基石。',
    content: 'WXML 用双大括号 {{ }} 把 js 里 data 的值绑定到界面上，这和 Vue 的模板语法非常接近。\n\n列表渲染用 wx:for，配合 wx:key 提高性能；条件渲染用 wx:if 和 wx:else，也可以用 hidden 控制显示隐藏——前者是真正不渲染，后者只是不显示。\n\n修改数据必须用 this.setData()，直接给 this.data 赋值不会触发界面更新。setData 的值要尽量小、路径要尽量精确，这是小程序性能优化的第一课。\n\n本项目列表页就综合用到了 wx:for、wx:if（加载中/出错/正常三种状态切换），可以对照源码学习。'
  },
  {
    id: 3,
    title: '事件系统：bindtap 与传参',
    author: '小记',
    date: '2026-10-18',
    summary: '小程序的事件用 bind 开头绑定，传参靠 data-xxx 自定义属性。',
    content: '小程序不能用 onclick，而是用 bindtap、bindinput、bindchange 这类以 bind 开头的属性绑定事件。\n\n给事件处理函数传参不能写成 bindtap="fn(1)"，而是在节点上写 data-id="{{item.id}}"，处理函数里通过 e.currentTarget.dataset.id 取出来。\n\ncatchtap 与 bindtap 的区别是：catch 会阻止事件继续冒泡，bind 不会。\n\n本项目的文章列表卡片就是用 data-id 传文章 id，点击后跳转到详情页，可以直接体验。'
  },
  {
    id: 4,
    title: 'wx.request 与数据拉取',
    author: '小记',
    date: '2026-10-17',
    summary: 'wx.request 是小程序的网络请求入口，封装一层能让代码整洁很多。',
    content: 'wx.request 相当于浏览器里的 fetch，但它默认回调式，代码容易嵌套过深。\n\n常见做法是封装成 Promise：统一 baseUrl、统一超时、统一处理业务码。本项目 utils/request.js 只有几十行，就是这样一个封装，页面里调用时只需要 request(\'/api/articles\')。\n\n要注意域名白名单：正式环境请求的域名必须在小程序后台配置过，开发阶段可以在开发者工具「详情-本地设置」里勾选「不校验合法域名」。\n\n本项目已在 project.config.json 预置 urlCheck: false，配合本地 mock 服务开箱即用。'
  },
  {
    id: 5,
    title: '页面路由与参数传递',
    author: '小记',
    date: '2026-10-16',
    summary: 'wx.navigateTo 跳新页面，wx.switchTab 切 tab，参数通过 url 问号传递。',
    content: '小程序有五种页面跳转方式：navigateTo（入栈新页面）、redirectTo（替换当前页）、switchTab（切换 tabBar 页面）、reLaunch（重启到某页）、navigateBack（返回）。\n\n注意 tabBar 页面只能用 switchTab 跳转，用 navigateTo 会报错。\n\n传参方式是 url 问号串：/pages/detail/detail?id=3，目标页在 onLoad(options) 里拿到 options.id。复杂对象建议先存 storage 或全局数据，只传 id 再查详情是最常见的做法。\n\n本项目：首页到详情用 navigateTo 传 id，tab 之间用 switchTab，正好覆盖两种典型场景。'
  },
  {
    id: 6,
    title: 'rpx 响应式单位详解',
    author: '小记',
    date: '2026-10-15',
    summary: 'rpx 让同一份样式在所有屏幕上等比缩放：750rpx 永远等于屏幕宽度。',
    content: 'rpx（responsive pixel）是小程序特有的单位，规定任何机型上屏幕宽度都等于 750rpx。\n\n也就是说在 iPhone 6（375px 宽）上 1rpx = 0.5px，在更宽的屏幕上 1rpx 会自动变大。设计师给的 750 宽度的设计稿，标注多少 px 就直接写多少 rpx，无需换算。\n\n实践中一般用 rpx 写布局尺寸，用 px 写 1px 细边框（rpx 在小屏上会小于 1 物理像素导致边框消失）。\n\n本项目全局样式 app.wxss 里大量使用了 rpx，可以对照设计稿理解。'
  },
  {
    id: 7,
    title: '本地存储 wx.setStorage 实战',
    author: '小记',
    date: '2026-10-14',
    summary: '小程序给每个用户 10MB 本地缓存，适合存 token、主题偏好等轻量数据。',
    content: 'wx.setStorageSync(key, value) 同步写缓存，wx.getStorageSync(key) 同步读，removeStorageSync 删除，clearStorageSync 清空。\n\nStorage 是按小程序维度隔离的，同一个用户在不同手机上缓存互不相通，单个 key 最大 1MB，总量 10MB。\n\n典型用法是缓存接口数据做「秒开」：进页面先读缓存渲染，同时请求最新数据覆盖，这就是简单的缓存策略。\n\n注意 Storage 只适合轻量结构化数据，大文件要用文件系统 API，敏感信息（如 token）要评估安全性。'
  },
  {
    id: 8,
    title: 'tabBar 配置与图标规范',
    author: '小记',
    date: '2026-10-13',
    summary: 'tabBar 最少 2 个最多 5 个 tab，图标是 81px 的 png，选中与未选中各一张。',
    content: 'tabBar 在 app.json 里配置，list 最少 2 项、最多 5 项，pagePath 必须是已注册的页面。\n\n图标要求是 81px x 81px 的 png，不支持网络图片，必须是本地文件；每个 tab 需要普通和选中两张。iconPath 对应未选中，selectedIconPath 对应选中。\n\n本项目 tools/gen-icons.js 用 Node 内置模块零依赖地生成了全部 6 张图标（3 个 tab x 2 种状态），想改颜色或形状可以直接改脚本重新生成。\n\ntabBar 只能配置在 app.json，页面内部还可以用 wx.setTabBarItem 动态改角标，比如未读消息数。'
  },
  {
    id: 9,
    title: '真机预览与调试技巧',
    author: '小记',
    date: '2026-10-12',
    summary: '工具里一切正常，真机上却出问题？这些调试技巧帮你定位。',
    content: '开发者工具左上角「预览」会生成二维码，手机微信扫码即可真机运行，这是最常用的真机调试方式。\n\n真机上点右上角胶囊「...」可以打开 vConsole，查看 console 日志和网络请求；也可以用「真机调试」模式，在电脑工具里直接调试手机上的代码。\n\n常见坑：工具支持的新 API 真机基础库不支持（记得配最低基础库版本）；本地 localhost 地址真机访问不到（要改成电脑局域网 IP）；rpx 在真机上的舍入误差导致 1px 边框消失。\n\n本项目请求的是 127.0.0.1，真机预览时请把 utils/request.js 的 BASE_URL 改成电脑的局域网 IP，并保证手机和电脑在同一网络。'
  },
  {
    id: 10,
    title: '从开发到发布的完整流程',
    author: '小记',
    date: '2026-10-11',
    summary: '注册小程序账号、拿到 appid、上传代码、提交审核、发布上线，全流程一览。',
    content: '注册一个小程序账号（个人主体免费）后，在「管理-开发管理-开发设置」里拿到 AppID，填入项目的 project.config.json（本项目已预置正式 AppID，导入即用）。\n\n开发完成后，在开发者工具点「上传」，填写版本号和备注，代码就进入了微信后台的「开发版本」。\n\n然后在 mp 后台把开发版本「提交审核」，审核通过后手动「发布」，用户就能搜索到你的小程序了。体验版则是不用审核、指定体验成员即可使用的版本，适合内测。\n\n建议每次发布前用真机把核心流程过一遍，审核被拒最常见的原因是类目不符和诱导分享。'
  }
];

/** 统一 JSON 响应 */
function send(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(text);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const { pathname } = url;
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${pathname}`);

  // 预检请求直接放行（便于 H5 端调试）
  if (req.method === 'OPTIONS') return send(res, 204, {});

  if (req.method !== 'GET') {
    return send(res, 405, { code: 405, message: 'Method Not Allowed', data: null });
  }

  if (pathname === '/api/health') {
    return send(res, 200, { code: 0, message: 'ok', data: { status: 'up', time: new Date().toISOString() } });
  }

  if (pathname === '/api/articles') {
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const size = Math.min(50, Math.max(1, parseInt(url.searchParams.get('size') || '5', 10) || 5));
    const keyword = (url.searchParams.get('keyword') || '').trim();

    let list = articles;
    if (keyword) {
      list = articles.filter(a => a.title.includes(keyword) || a.summary.includes(keyword));
    }
    const start = (page - 1) * size;
    const items = list.slice(start, start + size).map(({ content: _content, ...rest }) => rest); // 列表不返回正文

    return send(res, 200, {
      code: 0,
      message: 'ok',
      data: { list: items, page, size, total: list.length, hasMore: start + size < list.length },
    });
  }

  const match = pathname.match(/^\/api\/articles\/(\d+)$/);
  if (match) {
    const article = articles.find(a => a.id === Number(match[1]));
    if (!article) return send(res, 404, { code: 404, message: '文章不存在', data: null });
    return send(res, 200, { code: 0, message: 'ok', data: article });
  }

  send(res, 404, { code: 404, message: 'Not Found', data: null });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock API 已启动（监听 0.0.0.0:${PORT}）`);
  console.log(`  本机:     http://127.0.0.1:${PORT}`);
  console.log(`  手机预览: http://${lanIP()}:${PORT}   ← 需与 demo-app/utils/request.js 的 BASE_URL 一致`);
  console.log('试试: curl http://127.0.0.1:3001/api/health');
});
