# HiFleet Tools —— DeepSeek Harness 插件（非官方）

本目录是 HiFleet Tools（作者 Creeper2026，上游版本 **2.1.1**）的 **DeepSeek Harness（DSH）发行形态**。
它内置上游的零依赖 Node MCP 服务器，通过 DSH 的 `@deepseek-ai/dsh-mcp-client` 以 stdio 接入，
工具发布名为 `mcp__hifleet__<原工具名>`（例如 `mcp__hifleet__hifleet_vessel`）。

> 非官方插件，与 HiFleet 官方无隶属关系。请遵守目标站点的服务条款与访问限制。

## 目录结构

```
dsh-hifleet-mcp/
├── package.json            # DSH bundle 清单（dsh.bundle.patch 指向 cordis.patch.yml）
├── cordis.patch.yml        # MCP 连接声明：insert @deepseek-ai/dsh-mcp-client
├── locale/en.json          # 插件显示名/描述（英文）
├── locale/zh.json          # 插件显示名/描述（中文）
├── icon.svg                # 插件图标（沿用上游 assets/app-icon.svg）
├── README.md               # 本文件
├── PROVENANCE.md           # 上游来源与转换记录
├── .env.example            # 自动登录模板（复制为 .env 后填写）
├── .gitignore              # 忽略 .env / 会话文件
├── login.cmd               # Windows 双击登录入口（密码输入不回显）
├── index.js                # Host half：/dsh-hifleet/api/* 路由（凭据状态/保存/删除）
├── client.js               # 浏览器设置页：DSH 设置 → “HiFleet 账号”（纯 JS，无需构建）
├── server/                 # 内置 Node MCP 服务器（零依赖；默认复用 DSH 自带的 Electron 运行时）
│   ├── main.mjs            # stdio JSON-RPC 服务
│   ├── client.mjs          # HTTP / Cookie / mtk / 本地会话
│   ├── env.mjs             # .env 读取
│   ├── tools.mjs           # 模块工具 + action 分发
│   └── login.mjs           # 本地登录 CLI（不是 MCP tool）
├── shared/actions.json     # 全量 action 注册表
└── skills/hifleet/         # 渐进式文档（SKILL.md + reference/*.md）
```

## 安装到 DSH

本 bundle 是 profile 级插件。安装后**新建会话**即可看到 `mcp__hifleet__*` 工具。

- 方式一（图形界面）：DSH → 插件管理 → 安装本地 bundle → 选择本目录。
- 方式二（等价接口）：`plugin_manager` 的 `install_bundle`，target 填本目录的绝对路径
  （不同机器填该机器上的路径即可，本 bundle 内部不依赖任何绝对路径）。

安装后自检：

1. 配置里出现 `include:hifleet-mcp`（`@deepseek-ai/dsh-mcp-client` 的 config 条目）；
2. 工具列表出现 11 个 `mcp__hifleet__*` 工具；
3. 调用 `hifleet_help` 返回模块列表即接入成功。

> 同一 profile 内 `serverName` 必须唯一（本插件用 `hifleet`）。本 bundle 包名为
> `@local/dsh-hifleet-tools`（更早的本地安装曾用 `@local/dsh-hifleet-mcp`，两者不同名）；
> 安装/卸载请认准当前包名。

### 路径与运行时（可移植性）

`cordis.patch.yml` 里**没有任何绝对路径**，所以：

- 把本目录移动到任何位置（甚至换一台电脑/改名文件夹）都**不需要修改本文件**；
- `command` 复用 DSH 自带的 Electron（搭配 `ELECTRON_RUN_AS_NODE=1`）当 Node 用，
  因此**不要求使用者单独安装 Node.js**；
- `args` / `cwd` 由 Loader 的 `!!js` 表达式在加载时算出：
  `baseUrl`（当前 profile 目录）+ 包名（`package.json` 的 `name`）→
  `<profile>/node_modules/@local/dsh-hifleet-tools/server/main.mjs`。

只有在**改了 `package.json` 的 `name`**（例如 fork 后重命名包）时，才需要把
`cordis.patch.yml` 中两处 `node_modules/@local/dsh-hifleet-tools` 换成新包名。
如果更想用系统 Node（>= 20.19.0）：把 `command` 改成 `node`，并删掉 `env` 里的
`ELECTRON_RUN_AS_NODE` 即可。

## 账号设置（推荐，DSH 图形界面）

首次使用、或更换 HiFleet 账号时：

1. 打开 **DSH 设置 → “HiFleet 账号”**；
2. 填写 HiFleet 用户名（手机号/邮箱）和密码，点“保存”；
3. 下一次调用 HiFleet 工具时会自动用这组账号登录，**无需重启 DSH**。

也可以在 **插件管理 → HiFleet Tools 详情页** 找到同一个面板（同一份状态与按钮）。

- 凭据保存在 `%USERPROFILE%\.hifleet\credentials.json`（可用 `HIFLEET_CREDENTIALS` 覆盖）；
  仅在本机落盘，保存后密码不再回显，面板只显示“已保存”状态。
- 保存后会**一律清除旧的登录会话**（换账号、同一账号改密码都适用），下一次调用用新凭据重新登录。
- “删除”按钮只删本地凭据文件；已登录的会话要另用 `hifleet_account` 的 `logout` 或
  删除 `session.json`。
- 写接口只接受本机回环请求，并要求 `content-type: application/json` + 自定义头
  `x-dsh-hifleet: 1`（CSRF 防护）；跨站页面无法伪造这两个条件。
- 凭据来源优先级：进程/MCP 配置的 `HIFLEET_USERNAME`/`HIFLEET_PASSWORD` > 设置页保存的
  `credentials.json`。

## 登录（其他方式）

> 日常使用请优先用上面的“账号设置”面板；以下方式适合无图形界面或部署场景。


多数数据接口需要登录。登录结果保存在 `%USERPROFILE%\.hifleet\session.json`
（可用 `HIFLEET_SESSION` 覆盖），之后所有工具调用自动复用。账号需先在 HiFleet 官网注册。

### 双击 `login.cmd`（无图形界面时）

1. 在插件目录双击 `login.cmd`（也可以把快捷方式发给使用者）；
2. 按提示输入 HiFleet 账号，密码输入时不回显；
3. 看到“登录成功，会话已保存”即可回到 DSH 直接使用。

> **登录即时生效**：DSH 运行期间完成登录后，下一次工具调用自动使用新会话，无需重启 DSH。
> 本发行版在 `server/tools.mjs` 的 `ensureAuth()` 中增加了“每次鉴权前重读会话文件”的补丁。

### 部署/无人值守：`.env` 自动登录

把 `.env.example` 复制为 `.env` 并填写账号密码：

```
cd D:\Creeper2026\HiFleet\plugin\dsh-hifleet-mcp
copy .env.example .env
notepad .env
```

首次调用需要登录的工具时会自动登录并保存会话，之后不再重复登录。
适合“一个账号供整个 DSH 使用”的部署；`.env` 已被 `.gitignore` 忽略，不要外传。

### 命令行登录

```
cd D:\Creeper2026\HiFleet\plugin\dsh-hifleet-mcp
node server\login.mjs
```

### 其他方式（不推荐）

- 对话中让 Agent 调用 `hifleet_account` 的 `login` action 传账号密码：能用，但密码会进入
  会话历史，只适合临时排障；用完建议调用 `logout` 并轮换密码。
- Python 运行时要另用上游 `server_py/login.py`，本 DSH 发行版只带 Node 实现。

不要把密码写进 `cordis.patch.yml` 或 MCP `config.env`：那是随 bundle 分发的配置；
请用本目录 `.env`（本地、被忽略）或双击 `login.cmd`。


## 环境变量

| 变量 | 说明 |
|---|---|
| `HIFLEET_USERNAME` / `HIFLEET_PASSWORD` | 自动登录账号（推荐写在 `.env`） |
| `HIFLEET_AUTO_LOGIN` | 设为 `0` 关闭自动登录 |
| `HIFLEET_SESSION` | 自定义会话文件路径 |
| `HIFLEET_ENV_FILE` | 自定义 `.env` 路径 |
| `HIFLEET_CREDENTIALS` | 自定义账号密码文件路径（默认 `%USERPROFILE%\.hifleet\credentials.json`） |

账号来源优先级：**进程/MCP 配置 env（含 `.env` 载入值）> 设置页保存的 `credentials.json`**。
其余配置优先级：MCP 配置 env > `.env` > 代码默认值。

> DSH 启动 stdio MCP 时会清洗继承环境变量：名称匹配 `KEY|PASSWORD|SECRET|TOKEN` 的变量
> 和 `DSH_*` 会被移除。因此不要把账号密码依赖 `process.env` 继承传入；请写进本目录的
> `.env`（服务器自己读取），或使用 DSH MCP 配置的 `config.env`（会覆盖清洗后的环境）。

## 工具（按模块聚合，11 个）

| 工具 | 覆盖范围 | 文档 |
|---|---|---|
| `hifleet_vessel` | 列表、搜索、档案、航次、挂靠、PSC、事故、风险、图片 | `skills/hifleet/reference/02-vessels.md`、`03-detail.md` |
| `hifleet_track` | 轨迹、停船点、全量船位、风场、SDK 位置 | `04-track.md` |
| `hifleet_route` | 气象航线、点到点、航线计划、沿航线天气、潮汐 | `05-route-weather.md` |
| `hifleet_port` | 港口经纬度、在港/预抵、天气、详情、OneOcean、留言 | `06-port.md` |
| `hifleet_schedule` | 班期列表/详情/关注/统计/联想/解锁 | `07-schedules.md` |
| `hifleet_fleet` | 船队船舶、分组、增删、权限、船舶报告 | `08-fleet-user.md` |
| `hifleet_typhoon` | 台风、地震、海况矢量、海浪/海图瓦片 | `09-typhoon.md` |
| `hifleet_account` | 会话、登录、登出、权限 | `08-fleet-user.md` |
| `hifleet_help` | 返回模块/action/文档路径 | — |
| `hifleet_session` | 本地会话状态 | — |
| `hifleet_request` | 兜底通用请求 | `01-common.md` |

调用格式：`{ "action": "...", "params": { ... } }`；写操作需同级传 `"confirm": true`。

## 与上游 Trae 插件（hifleet-mcp）的差异

保留：`server/*.mjs`（Node 实现）、`shared/actions.json`、`skills/hifleet/**`、`.env.example`、`.gitignore`。

DSH 形态新增：`package.json`、`cordis.patch.yml`、`locale/{en,zh}.json`、`icon.svg`、
`README.md`（本文件）、`PROVENANCE.md`、`login.cmd`、`index.js`（Host half，设置接口路由）、
`client.js`（浏览器设置页）。图标沿用上游 `assets/app-icon.svg`。

DSH 适配补丁：`server/tools.mjs` 的 `ensureAuth()` 每次鉴权前重读会话文件，登录后无需重启 DSH。

未包含（Trae 专属或 DSH 用不到）：

- `.trae-plugin/plugin.json`、`.mcp.json`、`.mcp.python.json`、`mcp.local*.json` —— Trae 的清单与本地配置；
- `server_py/`（Python 实现）—— DSH bundle 只保留 Node 运行时；如需 Python 版请用上游插件；
- `__pycache__/`、`.idea/` 等构建/IDE 产物。

## 升级 / 同步上游

本目录的运行时是 `..\hifleet-mcp` 的副本。上游更新后，从 `..\hifleet-mcp` 覆盖：

```
Copy-Item ..\hifleet-mcp\server\*.mjs .\server\ -Force
Copy-Item ..\hifleet-mcp\shared\actions.json .\shared\ -Force
Copy-Item ..\hifleet-mcp\skills\hifleet\* .\skills\hifleet\ -Recurse -Force
```

然后同步修改 `package.json` 的 `version`，确认 `cordis.patch.yml` 路径未变，再重装 bundle。

## 自测

```
node --check server\main.mjs
node --check server\client.mjs
node --check server\env.mjs
node --check server\tools.mjs
node --check server\login.mjs
```

手工 stdio 握手（PowerShell）：

```
$lines = @(
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}}',
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
) -join "`n"
$lines | node server\main.mjs
```

stdout 只输出 JSON-RPC 消息，日志全部在 stderr（`[hifleet-mcp] server started (stdio)`）。

设置页接口自测（DSH 需正在运行，端口以实际 GUI 为准）：

```
Invoke-WebRequest http://127.0.0.1:64771/dsh-hifleet/api/status -UseBasicParsing
# 保存（仅本机回环，示例值请替换；测试完请调用 DELETE 清除）
Invoke-WebRequest http://127.0.0.1:64771/dsh-hifleet/api/credentials -Method Post `
  -ContentType 'application/json' -Body '{"username":"you","password":"secret"}' -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:64771/dsh-hifleet/api/credentials -Method Delete -UseBasicParsing
```
