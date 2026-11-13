# PROVENANCE —— dsh-hifleet-mcp

- 上游：HiFleet Tools（非官方 MCP 插件），作者 Creeper2026，版本 2.1.1。
- 上游目录：`D:\Creeper2026\HiFleet\plugin\hifleet-mcp`（Trae 插件格式）。
- 上游清单：`.trae-plugin/plugin.json`（name `hifleet-tools`，version `2.1.1`）。
- 转换产物：本目录，DeepSeek Harness（DSH）profile bundle：MCP 连接行 + Host/Client half（设置页）+ 内置 Node 运行时。
- 转换日期：2026-11-13。
- 许可：上游未声明（UNLICENSED）；版权归上游作者所有，本目录仅为本地集成副本。

## 文件对应关系

| 本目录 | 来源 |
|---|---|
| `server/main.mjs` | 上游 `server/main.mjs` |
| `server/client.mjs` | 上游 `server/client.mjs` |
| `server/env.mjs` | 上游 `server/env.mjs` |
| `server/tools.mjs` | 上游 `server/tools.mjs`（含 DSH 适配补丁，见下） |
| `server/login.mjs` | 上游 `server/login.mjs` |
| `shared/actions.json` | 上游 `shared/actions.json` |
| `skills/hifleet/**` | 上游 `skills/hifleet/**` |
| `.env.example`、`.gitignore` | 上游同名文件 |
| `icon.svg` | 上游 `assets/app-icon.svg` |
| `login.cmd` | 本次转换为 DSH 新增（Windows 双击登录入口） |
| `index.js` | 本次转换为 DSH 新增（Host half：`/dsh-hifleet/api/*` 凭据路由） |
| `client.js` | 本次转换为 DSH 新增（浏览器设置页：DSH 设置 → “HiFleet 账号”） |
| `package.json`、`cordis.patch.yml`、`locale/*.json`、`README.md`、`PROVENANCE.md` | 本次转换为 DSH 新增 |

未复制：`.trae-plugin/`、`.mcp*.json`、`mcp.local*.json`、`server_py/`、`__pycache__/`、`assets/app-icon.svg`（已转为 `icon.svg`）。

## DSH 适配补丁

- `server/tools.mjs`：`ensureAuth()` 在鉴权前执行 `client.loadSession()`，使 DSH 运行期间用
  `login.cmd` / `login.mjs` / `hifleet_account login` 完成的登录在下一次工具调用立即生效，
  无需重启 DSH 或重载插件（上游 2.1.1 只在 MCP 进程启动时读取一次会话文件）。
- `server/tools.mjs`（设置页补丁）：`ensureAuth()` 在会话缺失时读取
  `~/.hifleet/credentials.json`（可用 `HIFLEET_CREDENTIALS` 覆盖）或环境变量中的账号密码自动登录；
  登录失败会把 `autoLoginError` 带进 `hifleet_session` 结果，并在下次调用重试（不缓存失败）。
- `server/tools.mjs`（凭据切换修正）：对 credentials 文件内容做指纹（username + password +
  savedAt）；指纹变化时调用 `client.resetAuth()` 清空进程内旧 cookie 并强制下一次调用重新登录，
  `ensureAuth()` 的 in-flight `authPromise` 在每次结束时释放，从而不会因为“已经登录过”而忽略新凭据。
- `server/client.mjs`（凭据切换修正）：新增 `resetAuth()`，清空 cookies / mtk / usertoken /
  username / bootstrap 状态。
- `index.js`（保存语义修正）：保存凭据后一律删除旧 session 文件（覆盖同账号改密码）；
  写请求要求 `content-type: application/json` + `x-dsh-hifleet: 1`（CSRF 防护），空
  remoteAddress 视为非回环拒绝。
- `login.cmd`：Windows 双击登录入口，调用上游 `server/login.mjs`（密码输入不回显），
  `%*` 透传参数，退出码与 `login.mjs` 一致。
- `index.js`（Host half）：仅注册两条 `webServer` exact 路由（`GET /dsh-hifleet/api/status`、
  `POST/DELETE /dsh-hifleet/api/credentials`），仅接受回环请求；凭据写
  `%USERPROFILE%\.hifleet\credentials.json`（06/0700 语义，临时文件 + rename）。
- `client.js`（浏览器 half）：纯 JS `window.__ModuleLoader__.load` 形式，注册
  `settings.section`（id `hifleet-account`，order 110）与 `plugins.bundle.config`
  （key `@local/dsh-hifleet-tools`），调用上面两条路由读写状态；React 来自宿主模块表。
- 包名：本地 bundle 从 `@local/dsh-hifleet-mcp` 改名为 `@local/dsh-hifleet-tools`，
  以绕开长驻 Host 对旧安装路径的内存缓存（旧名会指向已删除目录）。
- `cordis.patch.yml`（可移植性，2026-11-13 补做）：不再写死绝对路径——
  `command` 用 `!!js 'process.execPath'`（DSH 自带的 Electron，配合
  `ELECTRON_RUN_AS_NODE=1` 当 Node 运行；在纯 Node 启动的 DSH 下也自动等于 node），
  `args` / `cwd` 用 `!!js` 从 Loader 的 `baseUrl` + `package.json` 的 name 计算
  （`<profile>/node_modules/@local/dsh-hifleet-tools/server/main.mjs`）；
  移动目录/换机器无需改文件，使用者也无需另装 Node.js。

## 校验摘要（SHA-256）

658302551445476f18844b6125c20a962ec411d94b7f8f10dd4073ed9a7d8c93  server/main.mjs
fd509b1959de1c07c4e2873025c5729a7866bebc927e304dab7cc5319f527bf7  server/client.mjs
2279d93fc4fe53267850a64ad89b48ae184fbb648d779caf8f0de6ab28418483  server/env.mjs
511398abbb21b089605cf8198b259c4fb86482908cee1a41af53e71e95d00653  server/tools.mjs  # DSH 适配后与上游不同
863c7c3a3fb0303861053742c4415b96604c2a56ec89d1236323895166b5e773  server/login.mjs
2a7cef08f576c229b4307fb3d7e9720d5c6fbe24faceff5591bf72b6e44f400c  shared/actions.json
fb3ac21e8f2773315e65f36b7be6295f97b728e2a38d2b4d4bc22c2bc74ada6c  skills/hifleet/SKILL.md
eccf56290dd890dbff6007efea0e2731adde38d82820d3ac17bd38e870502c0b  index.js
c4bc2df2a7053cc770fa662b031bba46f390add0e3f919eef9543400543e6016  client.js
3928c2751337534604beef7fb163ace607290c7d3dfaa6afa64c56e326ef3bc5  login.cmd
d2d05f8fd8dd4a9b8a92d2aee22b65722a0f7f07a5e07cd8ef24c3f6432ce73f  package.json
769368357528ee73d0ef98b71d65d38aee4e4149ada9d96650c42dda63fdffde  cordis.patch.yml
504311d39a8a0d57f80dff0b7e33ed14d5b872e5cdfbd97abb6519621bfcb232  locale/en.json
ce184c984104156ec63a4bcc679038f8bb8df2248ddab427d91d14096540f13e  locale/zh.json
