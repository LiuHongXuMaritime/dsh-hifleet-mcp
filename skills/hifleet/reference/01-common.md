# 01 · 通用约定与鉴权

## 1. 域名分工

| 域名 | 用途 |
|---|---|
| `www.hifleet.com` | 网页内部接口：`/particulars/*`、`/hifleetapi/*`、`/portofcall/*`、`/hifleetrouteapi/*`、`/shipdetail/*` |
| `api.hifleet.com` | SDK / 开放平台接口：`/position/*`、`/port/*`、`/typhoon/*`、`/oceanweather/*`，必须带 `usertoken` |
| `static.hifleet.com` | JS / CSS / 图片资源 |

## 2. 通用请求约定

| 项 | 说明 |
|---|---|
| 语言 | `i18n=zh` / `i18n=en`；Cookie `Browserlang=zh/en` |
| 客户端版本 | `_v=5.3.588`（列表）、`5.3.703`（档案）、`5.3.731`（轨迹）、`5.4.585`（航线/瓦片） |
| JSON 请求 | `Content-Type: application/json`（仅列表 `getShipDatav3` 等少数接口） |
| 表单请求 | `Content-Type: application/x-www-form-urlencoded;charset=UTF-8`（多数 `.do`） |
| 常用 Header | `Origin: https://www.hifleet.com`、`Referer`、`X-Requested-With: XMLHttpRequest`、`Accept: application/json, text/plain, */*` |
| 登录 Cookie | `JSESSIONID`（会话）、`TGC`（CAS 登录票据） |

工具包默认带好这些 Header，只需注入 Cookie：

```python
from hifleet import HiFleetClient

client = HiFleetClient(auto_bootstrap=True)
client.set_cookies({"JSESSIONID": "...", "TGC": "..."})
```

`auto_bootstrap=True` 会先访问 `/vessels/?i18n=zh` 获取 `JSESSIONID` 和 `Browserlang`。

### 本地会话持久化

登录成功后，工具包会把 Cookie、`mtk`、`usertoken` 写入 `~/.hifleet/session.json`（权限 0600）：

```python
from hifleet import ensure_login, login, logout, session_status

login(client, "your@email.com", "password")          # 首次登录并保存
ensure_login(client, username="your@email.com", password="password")  # 失效自动重登
print(session_status(client))
logout(client)                                        # 退出并删除会话
```

- 本地只保存会话，不保存密码；密码来自函数参数或环境变量 `HIFLEET_USERNAME` / `HIFLEET_PASSWORD`。
- 登录接口成功后会用 `loginstatus.do` 再校验一次，避免“假成功”。
- 若站点要求腾讯验证码或 CAS 登录，脚本会提示改用 Cookie 注入。
- 登录响应里的 `mtk` 会自动附加到后续 `/hifleetapi/` 请求的查询参数上，与网页行为一致。

## 3. 响应包裹

站点存在四种响应形态，工具包已统一处理：

```json
// A. 通用
{"status":"1","msg":"","data":{},"total":0,"s402":null,"timestamp":1794497196383}

// B. 挂靠/航次
{"result":"OK","num":1,"list":{}}

// C. 港口/班期
{"message":"ok","total":3,"data":[]}

// D. SDK
{"code":500,"message":"Required String parameter 'usertoken' is not present","url":"/port/getports/token"}
```

另有直接返回数组（搜索联想、船型字典、在港统计）和 XML（船舶特征、图片、停泊点）的接口。

## 4. 错误归一化

工具包把站点异常映射为四类异常（`hifleet/errors.py`）：

| 异常 | 触发条件 | 处理方式 |
|---|---|---|
| `LoginRequired` | HTTP 401；`msg` 为 `NOT LOGIN` / `未登录` / `登录信息已失效` | 注入登录 Cookie |
| `CaptchaRequired` | `status` 为 `402` 或 `S402` | 用 `exc.s402` 作为 `authItemCode` 过腾讯验证码 |
| `SdkTokenRequired` | `code=4005` 或缺少 `usertoken` | 使用 `api.hifleet.com` 的 token |
| `ApiError` | `status=0` 且带错误信息（如「接口异常」「无权限操作」） | 看 `exc.msg` / `exc.payload` |

```python
from hifleet.errors import CaptchaRequired, LoginRequired

try:
    data = vessels.list_ships(client)
except LoginRequired:
    ...
except CaptchaRequired as exc:
    print("需要验证码，authItemCode =", exc.s402)
```

## 5. 验证码流程

```
业务接口返回 {"status":"402","s402":"<authItemCode>"}
        ↓
前端弹腾讯验证码 TCaptcha
        ↓
POST /shipdetail/capture/verify
     ticket=...&randstr=...&authItemCode=<s402>&i18n=zh
        ↓
{"status":"1"} → 重试原请求
```

对应函数：

```python
from hifleet import schedules

schedules.verify_captcha(client, ticket, randstr, auth_item_code)
```

## 6. 请求工具方法

`HiFleetClient` 暴露四个底层方法，业务模块全部基于它们：

```python
client.get("/particulars/getShipType")
client.post_form("/hifleetapi/getShipSuggest.do", {"q": "MAERSK", "type": "1"})
client.post_json("/particulars/getShipDatav3", {...})
client.sdk_get("/typhoon/getcurrenttyphoonlist/token", usertoken="...")
```

自定义请求：

```python
payload = client.request(
    "POST",
    "/hifleetapi/getShipsFeatureXml.do",
    data={"mmsi": "205096000", "limit1": 0, "limit2": 1, "select_type": 5},
    expect="text",       # XML 接口
    check=False,         # 跳过 JSON 错误检查
)
```

## 7. 已确认的坑

- `getShipDatav3` 匿名调用返回 `{"status":"0","msg":"接口异常,请稍后重试"}`，分页需要登录态；首屏数据在 HTML 里直出。
- 航线天气参数名是 `wavevlue`（源码拼写错误），不是 `wavevalue`。
- `/khifleetapi/kgetShipsTrajectory2/3.do` 在 `www.hifleet.com` 直接请求 404，日常用 `/hifleetapi/getShipsTrajectory.do`。
- 部分接口返回 HTTP 200 但 `msg=未登录`，不能只看状态码。
- 匿名访问船舶档案时，除 `basicInfo` 外的字段常为 `******`。
