---
name: hifleet-tools
description: HiFleet 全功能只读/可控写操作 MCP 工具。按模块聚合为 hifleet_vessel、hifleet_track、hifleet_route、hifleet_port、hifleet_schedule、hifleet_fleet、hifleet_typhoon、hifleet_account，具体 action 和参数放在 reference/*.md，按需读取。
---

# HiFleet Tools（非官方）

## 渐进式使用规则

1. 先调用 `hifleet_help`，拿到模块、action 列表和文档路径。
2. **只读当前任务需要的那个 reference 文件**，不要一次读完所有文档。
3. 调用 `hifleet_<模块>`，传 `action` 和 `params`。
4. 需要登录的 action 先读取 `reference/01-common.md` 的会话部分。
5. 写操作必须在 `params` 同级传 `confirm: true`。

## 模块索引

| 工具 | 覆盖范围 | 文档 |
|---|---|---|
| `hifleet_vessel` | 列表、搜索、档案、航次、挂靠、PSC、事故、风险、图片 | `reference/02-vessels.md`、`reference/03-detail.md` |
| `hifleet_track` | 轨迹、停船点、全量船位、风场、SDK 位置 | `reference/04-track.md` |
| `hifleet_route` | 气象航线、点到点、航线计划、沿航线天气、潮汐 | `reference/05-route-weather.md` |
| `hifleet_port` | 港口经纬度、在港/预抵、天气、详情、OneOcean、留言 | `reference/06-port.md` |
| `hifleet_schedule` | 班期列表/详情/关注/统计/联想/解锁 | `reference/07-schedules.md` |
| `hifleet_fleet` | 船队船舶、分组、增删、权限、船舶报告 | `reference/08-fleet-user.md` |
| `hifleet_typhoon` | 台风、地震、海况矢量、海浪/海图瓦片 | `reference/09-typhoon.md` |
| `hifleet_account` | 会话、登录、登出、权限 | `reference/08-fleet-user.md` |

辅助工具：

- `hifleet_help`：返回模块/action/文档路径
- `hifleet_session`：查看本地会话状态
- `hifleet_request`：兜底通用请求，可调用文档中任何接口

## 调用示例

```json
{
  "name": "hifleet_vessel",
  "arguments": {
    "action": "search",
    "params": { "keyword": "205096000" }
  }
}
```

```json
{
  "name": "hifleet_route",
  "arguments": {
    "action": "weather",
    "params": {
      "start": "121.666667,38.916667",
      "end": "121.6147,31.36636",
      "speed": 10,
      "wavevlue": 5
    }
  }
}
```

写操作示例：

```json
{
  "name": "hifleet_fleet",
  "arguments": {
    "action": "add",
    "params": { "mmsi": "205096000", "checkedgroup": "关注船" },
    "confirm": true
  }
}
```

## 认证

- 需要登录的工具读取 `~/.hifleet/session.json`。
- 登录（DSH 发行版）：双击插件目录的 `login.cmd`，或运行 `node server/login.mjs`（密码输入不回显）；
  DSH 运行中登录后立即生效，无需重启。
- 工具不接收密码；不要把密码写进对话。
- 登录失效返回 `LOGIN_REQUIRED`；触发验证码返回 `CAPTCHA_REQUIRED` 和 `s402`。

## 限额

- `hifleet_port` 的 `list` 匿名约 500 条后触发 `findaport_index` 配额。
- 轨迹、挂靠、PSC、班期、船队需要登录。
- 写操作和付费解锁必须 `confirm: true`，但仍建议先向用户确认。

## 边界

- 只调用 allowed 前缀内的 HiFleet 接口；不要用 `hifleet_request` 访问其他站点。
- 不绕过验证码、不伪造 Cookie、不把会话文件内容发到外部。
- 非官方插件，与 HiFleet 官方无隶属关系；提醒用户遵守服务条款。
