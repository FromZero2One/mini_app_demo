# AGENTS.md

WeChat mini-program dev platform: a native demo app + a zero-dependency Node mock API + icon tooling + Chinese docs. No bundler, framework, or test suite.

**The repo is `E:\miniprogram-dev`** — the workspace root `E:\` is not the repo. `cd` in before any git/npm command.

## Layout
- `demo-app/` — native WeChat mini program (WXML/WXSS/JS/JSON). `app.json` `pages` array is the page registry and its first entry is the startup page; DevTools compiles directly (no build step). Data access goes through `utils/data.js` → `cloud-api.js` (default; cloud env `cloud1-d8g774cfa69b034d6`, function `cloudfunctions/articles` with ping/list/detail/seed) or `mock-api.js` (local HTTP). Includes a Canvas 2D game page (`pages/game`; pure logic split into `pages/game/logic.js` for unit tests).
- `mock-server/server.js` — zero-dependency HTTP API on port 3001, binds `0.0.0.0`; data is hard-coded in this file (10 articles, numeric `id`s must stay stable — detail lookup uses them).
- `tools/gen-icons.js` — generates the 6 tabBar PNGs into `demo-app/images/` (81×81).
- `docs/开发者入门指南.md` — structure/onboarding guide; `README.md` — platform ops. Keep both in sync with structural or API changes.

## Commands (verified)
- Start mock API: `cd mock-server && npm start` → http://127.0.0.1:3001 (zero deps, no `npm install`; keep it that way).
- Regenerate tabBar icons: `node tools/gen-icons.js` (overwrites `demo-app/images/tab-*.png`; never hand-edit those PNGs).
- `npm run check` — every JS file passes `node --check` and every JSON parses (zero-dep `tools/check.js`).
- `npm test` — Node built-in test runner: game pure logic (`tools/tests/game-logic.test.js`) + mock API integration on port 3199 (`tools/tests/mock-api.test.js`).
- `npm run lint` — ESLint (flat config); `npm run format` — Prettier. `npm install` at repo root is dev-only tooling (eslint/prettier); the mini program and mock-server need no install.
- Cloud deploy: right-click `cloudfunctions/articles` in DevTools, **or** (when the IDE service port is enabled) use the CLI: `"F:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat" cloud functions deploy --project "E:\miniprogram-dev\demo-app" --env cloud1-d8g774cfa69b034d6 --names articles --remote-npm-install --port <port>`. Uploading a version is the same pattern with `cli upload --version <v> --desc <d> --port <port>`. The app auto-seeds on launch (idempotent); the 关于 page also has a manual seed button. Cloud calls cannot be verified locally.
- API smoke test: `curl http://127.0.0.1:3001/api/health` (also `/api/articles?page=1&size=3`, `/api/articles/1`).
- CI: `.github/workflows/ci.yml` runs `npm ci` → lint → check → test on push/PR. Do not invent other commands.

## WeChat-specific gotchas
- **DevTools rewrites `project.config.json` while open** (appid, settings, `libVersion`). Edit it only while DevTools is closed, then reopen; change AppID via 详情 → 基本信息. Otherwise your edit is silently reverted.
- `project.private.config.json` is DevTools-generated and gitignored — never commit or hand-edit it.
- AppID must be a real **mini-program** AppID (current `wxa0b1412247dddd0e`). A 公众号 AppID fails with `invalid app type`; sandbox 测试号 can debug but never upload; a WeChat account without admin/developer rights fails with `-80002 登录用户不是该小程序的开发者`.
- `utils/request.js` `BASE_URL` is a **LAN IP** (`http://192.168.31.56:3001`) so a phone on the same Wi-Fi can reach the mock. If the PC IP changes, update it; `mock-server` prints the current LAN IP at startup.
- `project.config.json` keeps `urlCheck: false` to allow plain-HTTP local calls — keep it.
- Debug DevTools-side failures (upload/appid/cloud) in `C:\Users\Administrator\AppData\Local\微信开发者工具\User Data\<hash>\WeappLog\logs`, read as GBK (codepage 936). Multiple profiles exist (different installs/accounts), so read the newest log across all `User Data\*\WeappLog\logs`; errors carry the real error codes.

## Environment quirks
- Windows PowerShell here renders Chinese as GBK mojibake — trust the `read` tool / file bytes, not console output. Don't "fix" encoding damage that only exists on screen.
- The 232 MB installer under `tools/*.exe` is gitignored — never commit binaries.
- A mock-server instance may already run in the background; check port 3001 before starting another.
- Git prints `LF will be replaced by CRLF` warnings on Windows — expected, not an error.
- Remote: `origin` = `git@github.com:FromZero2One/mini_app_demo.git`; `main` tracks `origin/main`.

## Conventions
- **Hard rule: always use AppID `wxa0b1412247dddd0e`** in every `project.config.json`; never use `touristappid` or a 测试号 unless the user explicitly asks.
- UI copy, comments, and docs are Chinese; code identifiers are English.
- Layout uses `rpx` (750rpx = screen width); 1px borders use `px`.
- Cloud development is the **default** data source (env `cloud1-d8g774cfa69b034d6`, function `articles`); local mock stays available via `DATA_SOURCE = 'mock'` in `utils/config.js`. Never remove the abstraction without being asked.
- `pages/list/list.js` `PAGE_SIZE = 5` must match the mock server's default `size`.
- Uploading and 体验版 are manual DevTools steps; `/preview` QR needs the phone on the same Wi-Fi to reach the mock.
