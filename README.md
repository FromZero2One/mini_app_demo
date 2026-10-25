# 微信小程序开发平台（miniprogram-dev）

一套开箱即用的原生微信小程序开发环境：**demo 项目 + 本地 Mock 接口 + 工具脚本 + 开发者工具安装包**，已配置正式 AppID，导入微信开发者工具即可运行。

> 新手建议先读 **[开发者入门指南](docs/开发者入门指南.md)**：项目结构、必需文件、完整开发流程、常见错误速查。

## 目录结构

```
miniprogram-dev\
├── README.md                          # 本文件
├── docs\
│   └── 开发者入门指南.md              # 项目结构 + 开发流程 + 错误速查
├── tools\
│   ├── gen-icons.js                   # tabBar 图标生成脚本（零依赖）
│   └── wechat_devtools_*.exe          # 微信开发者工具稳定版安装包（Windows 64）
├── mock-server\                       # 本地 Mock API 服务器（零依赖）
│   ├── server.js                      # 纯 Node 内置模块实现，端口 3001
│   └── package.json
└── demo-app\                          # 「小记」原生小程序 Demo
    ├── project.config.json            # 正式 AppID、关闭域名校验
    ├── app.js / app.json / app.wxss / sitemap.json
    ├── utils\request.js               # wx.request 的 Promise 封装
    ├── images\                        # tabBar 图标（由 gen-icons.js 生成）
    └── pages\
        ├── index\                     # 首页：问候、Mock 服务状态检测、功能入口
        ├── list\                      # 列表页：接口分页 + 下拉刷新 + 上加载更多
        ├── detail\                    # 详情页：url 传参 + 动态导航栏标题
        └── about\                     # 关于页：系统信息 API + 剪贴板
```

## 快速开始（3 步）

### 1. 启动本地 Mock 服务

```bash
cd mock-server
npm start
```

看到 `Mock API 已启动: http://127.0.0.1:3001` 即成功。浏览器打开
<http://127.0.0.1:3001/api/health> 可直接验证。

### 2. 安装微信开发者工具

双击 `tools\` 目录下的安装包（微信官方稳定版 2.01.2510260），按提示完成安装。
首次启动用微信扫码登录，登录的微信号需为小程序管理员或项目成员。

### 3. 导入 Demo 项目

开发者工具中：**项目 → 导入项目 → 目录选择 `demo-app` 文件夹**。

- AppID 自动读取项目里预置的正式 AppID（`wxa0b1412247dddd0e`），直接点「导入」
- 导入后模拟器自动编译运行，首页会显示「已连接」表示 Mock 服务联通
- 试试：列表页下拉刷新、上拉翻页、点卡片进详情页

## Demo 功能导览

| 页面 | 演示知识点 | 对应源码 |
|---|---|---|
| 首页 | 时段问候、wx.request 健康检查、switchTab 跳转 | `pages/index/` |
| 列表页 | 接口分页加载、下拉刷新、上拉加载更多、data-* 传参 | `pages/list/` |
| 详情页 | onLoad 接收 url 参数、动态设置导航栏标题、错误重试 | `pages/detail/` |
| 关于页 | 新版系统信息 API、剪贴板、版本回退兼容写法 | `pages/about/` |
| 全局 | 请求封装（Promise + 业务码）、tabBar 配置、rpx 布局 | `utils/request.js`、`app.json`、`app.wxss` |

## Mock 接口文档

统一返回格式：`{ "code": 0, "message": "ok", "data": {...} }`（`code` 非 0 表示业务错误）

| 接口 | 说明 | 参数 |
|---|---|---|
| `GET /api/health` | 健康检查 | 无 |
| `GET /api/articles` | 文章列表（不含正文） | `page`（页码，默认 1）、`size`（每页条数，默认 5）、`keyword`（标题/摘要模糊搜索） |
| `GET /api/articles/:id` | 文章详情 | 路径参数 `id`，不存在返回 HTTP 404 |

返回字段：`list`（数组）、`total`（总数）、`hasMore`（是否还有下一页）。

**加一个新接口**：打开 `mock-server/server.js`，仿照 `/api/health` 的写法加一个
`if (pathname === '/api/xxx') { ... }` 分支即可，改完保存，Ctrl+C 后重新 `npm start`。

## tools 工具说明

### gen-icons.js —— tabBar 图标生成

tabBar 图标要求 81x81 png、本地文件、每 tab 两张（普通/选中）。本脚本用
Node 内置模块零依赖生成全部 6 张图标（4 倍超采样抗锯齿）：

```bash
node tools/gen-icons.js     # 输出到 demo-app/images/
```

想改颜色或形状：编辑脚本里的 `COLORS`（普通 #999999 / 选中 #1a73e8）和
`drawHome` / `drawList` / `drawAbout` 三个绘制函数，重新运行即可。

## 常见问题（FAQ）

**Q：提示「不在以下 request 合法域名列表中」？**
本项目已在 `project.config.json` 预置 `"urlCheck": false`。如果仍提示，在开发者工具
右上角「详情 → 本地设置」勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」。

**Q：列表页一直显示「网络异常」？**
Mock 服务没启动。回到 `mock-server` 目录执行 `npm start`；首页的「接口状态」卡片可快速诊断。

**Q：真机预览时请求不通？**
本项目已按当前网络预置好：`BASE_URL = http://192.168.31.56:3001`，mock 服务监听
0.0.0.0。不通时按顺序排查：① 手机和电脑是否连的同一个 Wi-Fi；② 电脑局域网 IP
是否变了（`ipconfig` 查看 WLAN 的 IPv4，变了就同步更新 `demo-app/utils/request.js`
的 `BASE_URL`）；③ Windows 防火墙是否放行了 Node.js / 3001 端口（首次监听时弹窗要点「允许访问」）。

**Q：项目用的什么 AppID？能发布上线吗？**
项目预置的是个人主体正式账号的 AppID（`wxa0b1412247dddd0e`）。本地开发、真机预览、
上传代码、体验版、发布全部可用。发布流程：开发者工具右上角「上传」填写版本号 →
mp.weixin.qq.com 后台「版本管理」里提交审核 → 审核通过后手动发布。

**Q：提示「登录微信号与该小程序开发者不一致」或没有权限？**
登录开发者工具的微信号必须是小程序管理员或项目成员。到 mp.weixin.qq.com
「管理 → 成员管理 → 项目成员」里添加你的微信号（体验成员在「体验成员」里加）。

**Q：以后接真实后端，域名有什么要求？**
正式账号的 request 合法域名要求 HTTPS 且完成 ICP 备案，在 mp 后台
「开发管理 → 开发设置 → 服务器域名」配置。本地开发阶段不用管，
`urlCheck: false` 已允许请求 `http://127.0.0.1` 这类本地地址。

**Q：怎么清理模拟器缓存？**
开发者工具菜单「工具 → 清除缓存 → 全部清除」。

## 下一步建议

1. 对照 `pages/list/` 源码理解「数据驱动视图」：改 `data` 必须 `setData`
2. 给 mock 服务加一个 `POST /api/articles` 新建文章接口，并在列表页加个表单页
3. 学习本地存储：把列表数据缓存到 Storage，实现「无网秒开」
4. 需要组件化时，在 `demo-app/components/` 下创建自定义组件（官方文档：组件模板与样式）
