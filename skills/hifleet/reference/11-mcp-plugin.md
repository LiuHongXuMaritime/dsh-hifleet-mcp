# 11 · 本地 MCP 插件（全功能渐进式）

插件目录：[plugin/hifleet-mcp](../plugin/hifleet-mcp)
发布包：[plugin/hifleet-tools-2.1.1.zip](../plugin/hifleet-tools-2.1.1.zip)

同一插件内提供两套等价实现，任选其一启用：

- **Node 版**（默认 `.mcp.json`）：零 npm 依赖，Node 20.19+，适合发布。
- **Python 版**（`.mcp.python.json`）：复用仓库 `hifleet/` 包，适合自己/团队使用。

## 渐进式设计

不再把 80 多个接口一对一暴露，也不做“精选阉割版”。采用两层结构：

1. **按模块聚合工具**：Agent 先调用 `hifleet_help` 拿到模块、action 列表和文档路径。
2. **按需读 MD**：只读当前任务对应的 `skills/hifleet/reference/*.md`，不一次性加载全部文档。

这样既保留全量接口，又不会让工具列表和文档撑爆上下文。

## 目录

```
hifleet-mcp/
├── .trae-plugin/plugin.json   # 插件清单
├── .mcp.json                  # Node 版配置（默认）
├── .mcp.python.json           # Python 版配置
├── mcp.local.json             # 本机绝对路径配置（Node）
├── mcp.local.python.json      # 本机绝对路径配置（Python）
├── .env.example               # 自动登录模板
├── .gitignore                 # 忽略 .env / 会话文件
├── shared/actions.json        # 全量 action 注册表（两版共用）
├── server/                    # Node 实现
│   ├── main.mjs
│   ├── client.mjs
│   ├── env.mjs
│   ├── tools.mjs
│   └── login.mjs
├── server_py/                 # Python 实现
│   ├── main.py
│   ├── env.py
│   ├── tools.py
│   └── login.py
├── skills/hifleet/
│   ├── SKILL.md               # 渐进式索引入口
│   └── reference/             # 01~11 分模块文档
├── assets/app-icon.svg
└── README.md
```

## 工具清单

| 工具 | 覆盖范围 | 文档 |
|---|---|---|
| `hifleet_help` | 模块、action、文档路径索引 | — |
| `hifleet_request` | 兜底通用请求，可调任何已记录接口 | `reference/01-common.md` |
| `hifleet_session` | 本地会话状态 | — |
| `hifleet_vessel` | 列表、搜索、档案、航次、挂靠、PSC、事故、风险、图片 | `reference/02-vessels.md`、`03-detail.md` |
| `hifleet_track` | 轨迹、停船点、全量船位、风场、SDK 位置 | `reference/04-track.md` |
| `hifleet_route` | 气象航线、点到点、航线计划、沿航线天气、潮汐 | `reference/05-route-weather.md` |
| `hifleet_port` | 经纬度列表、在港/预抵、天气、详情、OneOcean、留言 | `reference/06-port.md` |
| `hifleet_schedule` | 班期列表/详情/关注/统计/联想/解锁 | `reference/07-schedules.md` |
| `hifleet_fleet` | 船队船舶、分组、增删、权限、船舶报告 | `reference/08-fleet-user.md` |
| `hifleet_typhoon` | 台风、地震、海况矢量、海浪/海图瓦片 | `reference/09-typhoon.md` |
| `hifleet_account` | 会话、登录、登出、权限 | `reference/08-fleet-user.md` |

调用格式：

```json
{
  "name": "hifleet_vessel",
  "arguments": {
    "action": "search",
    "params": { "keyword": "205096000" }
  }
}
```

写操作（船队增删、航线保存/删除、关注、留言、解锁等）必须在 `params` 同级传 `"confirm": true`。

## 全量 action

`shared/actions.json` 是唯一注册表，Node/Python 共用。覆盖：

- **vessel**：`search` `suggest` `same_search` `list` `types` `my_fleet` `archive` `current_voyage` `current_voyage_poc` `port_calls` `history_voyages` `recent_calls` `recent_calls_by_imo` `voyage_speed_time` `stopped_places` `psc` `psc_detail` `casualty` `casualty_detail` `risk` `sanction_risk` `abnormal` `destination` `images` `ship_images` `feature_xml` `has_detail` `stop_ships`
- **track**：`trajectory` `trajectory_envelop` `all_ships` `all_ships_xyz` `stop_records` `winds` `vyg_draught` `noon_position` `sdk_positions` `sdk_trajectory`
- **route**：`weather` `point_to_point` `plan_routes` `save` `update` `delete` `all_plans` `recommend_destination` `hangxian_date` `hangxian_wave` `hangxian_wind` `hangxian_weather` `weather_values` `ship_weather` `swell_direction` `tide`
- **port**：`list` `status` `weather` `region` `timezone` `detail` `plan_image` `weather_alarm` `one_ocean_port` `one_ocean_plans` `one_ocean_search` `one_ocean_section` `sdk_ports` `messages` `message_add` `message_delete` `message_edit`
- **schedule**：`list` `detail` `follows` `follow` `stats` `port_suggest` `company_suggest` `accuracy` `unlock_price` `unlock` `verify_captcha`
- **fleet**：`ships` `groups` `add` `remove` `login_status` `logout` `rights` `effective_auths` `report_query` `report_types` `report_delete`
- **typhoon**：`list` `positions` `forecast` `earthquakes` `ocean_times` `ocean_values` `wind_vector` `current_vector` `pressure_vector` `ocean_wave_url` `nautical_url`
- **account**：`status` `login` `logout` `rights` `effective_auths`

`hifleet_request` 可覆盖注册表之外的接口，例如天气瓦片、港口留言、SDK 海图等。

## 登录

```bash
cd plugin/hifleet-mcp
node server/login.mjs          # Node 版
python server_py/login.py      # Python 版
```

两版共用 `~/.hifleet/session.json`，与 Python 包也共用。
MCP 工具本身不接收密码；`account.login` 会接收账号密码，建议只在本机使用并注意对话上下文。

## 自动登录（推荐写在 MCP 配置的 env 里）

把账号密码写进本地 MCP 配置的 `env`：

```json
{
  "mcpServers": {
    "hifleet-tools": {
      "command": "node",
      "args": ["d:\\Creeper2026\\HiFleet\\plugin\\hifleet-mcp\\server\\main.mjs"],
      "cwd": "d:\\Creeper2026\\HiFleet\\plugin\\hifleet-mcp",
      "env": {
        "HIFLEET_USERNAME": "your@email.com",
        "HIFLEET_PASSWORD": "your-password"
      }
    }
  }
}
```

- 首次工具调用时若本地会话无效，自动登录并保存会话。
- 优先级：MCP 配置 env > `.env` > 默认值。
- `.env` 仍作为备选，放在插件根目录，支持 `HIFLEET_ENV_FILE` 指定路径。
- 不要把真实密码写进要发布的 `.mcp.json` / `.mcp.python.json`；只写在本机配置。
- `.env` 在 `.gitignore` 中，也不会打进发布 zip。

## MCP 配置

Node：

```json
{
  "mcpServers": {
    "hifleet-tools": {
      "command": "node",
      "args": ["d:\\Creeper2026\\HiFleet\\plugin\\hifleet-mcp\\server\\main.mjs"],
      "cwd": "d:\\Creeper2026\\HiFleet\\plugin\\hifleet-mcp"
    }
  }
}
```

Python：

```json
{
  "mcpServers": {
    "hifleet-tools-py": {
      "command": "python",
      "args": ["d:\\Creeper2026\\HiFleet\\plugin\\hifleet-mcp\\server_py\\main.py"],
      "cwd": "d:\\Creeper2026\\HiFleet\\plugin\\hifleet-mcp",
      "env": {
        "PYTHONIOENCODING": "utf-8",
        "PYTHONUNBUFFERED": "1"
      }
    }
  }
}
```

手动配置必须用绝对路径；`.mcp.json` 的相对路径只适用于会设置 `cwd` 的插件加载器。

## 错误约定

```json
{"ok": true, "data": {...}}
{"ok": false, "error": "LOGIN_REQUIRED", "message": "..."}
{"ok": false, "error": "CAPTCHA_REQUIRED", "message": "...", "s402": "findaport_index"}
{"ok": false, "error": "CONFIRM_REQUIRED", "message": "写操作必须 confirm=true"}
```

| error | 含义 |
|---|---|
| `LOGIN_REQUIRED` | 未登录/会话失效 |
| `CAPTCHA_REQUIRED` | 触发人机校验 |
| `CONFIRM_REQUIRED` | 写操作未确认 |
| `INVALID_ARGUMENT` | 参数错误 |
| `UNKNOWN_ACTION` | action 不存在 |
| `NETWORK_ERROR` | 网络失败 |
| `HTTP_ERROR` | 非 2xx |

## 发布检查

- [ ] 修改 `plugin.json` 的 `name` / `version` / `author` / `i18n`
- [ ] 不改 `.mcp.json` / `.mcp.python.json` 的相对路径
- [ ] 不打包 `~/.hifleet/session.json` 和 `.env`
- [ ] 保留 `.env.example`，不要把真实账号密码写进模板
- [ ] `shared/actions.json` 与两版工具同步
- [ ] `skills/hifleet/reference/*.md` 随包发布
- [ ] Node：`node --check server/*.mjs`
- [ ] Python：`python -m py_compile server_py/*.py`
- [ ] 解压 zip 后跑 `initialize` / `tools/list` / `tools/call`
- [ ] README 保留“非官方”声明和访问限制说明

## 已验证

Node 版和 Python 版都完成了同一组测试：

- `initialize`、`tools/list` 正常，返回 11 个工具（8 个模块 + help/request/session）
- `hifleet_help` 返回 8 个模块、全部 action 和文档路径
- `hifleet_vessel` 的 `search`、`archive`、`current_voyage` 正常
- `hifleet_route` 的 `weather`、`point_to_point` 正常
- `hifleet_port` 的 `status`、`weather` 正常
- `hifleet_port` 的 `list` 触发配额时返回 `CAPTCHA_REQUIRED`
- `hifleet_fleet` 的 `ships` 未登录返回 `LOGIN_REQUIRED`
- `hifleet_fleet` 的写操作未确认返回 `CONFIRM_REQUIRED`
- `hifleet_request` 可调用注册表之外的接口（已用船型字典验证）
- 两版 `.env` 读取通过（含 BOM 文件），`HIFLEET_AUTO_LOGIN=0` 可关闭自动登录
- Python 版 `py_compile` 通过；Node 版 `node --check` 通过
