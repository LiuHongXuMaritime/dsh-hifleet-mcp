# 07 · 班轮船期

对应模块：`hifleet.schedules`
前缀：`/shipdetail/schedules`

| 功能 | 接口 | 方法 | 鉴权 | 工具函数 |
|---|---|---|---|---|
| 班期列表 | `/shipdetail/schedules/schedules` | GET | 登录 | `list_schedules()` |
| 班期详情 | `/shipdetail/schedules/schedules/detail` | GET | 登录 | `detail()` |
| 我的关注 | `/shipdetail/schedules/follows` | GET | 登录 | `follows()` |
| 关注/取消 | `/shipdetail/schedules/follows` | POST JSON | 登录 | `follow()` |
| 统计 | `/shipdetail/schedules/stats` | GET | 公开 | `stats()` |
| 港口联想 | `/shipdetail/schedules/ports/suggest` | GET | 公开 | `port_suggest()` |
| 船公司联想 | `/shipdetail/schedules/companies/suggest` | GET | 登录 | `company_suggest()` |
| 准班率 | `/shipdetail/shippingScheduleAccuracy` | GET | 公开 | `accuracy()` |
| 解锁询价 | `/shipdetail/order/unLockPayPointQueryPrice` | GET | 登录 | `unlock_price()` |
| 扣点解锁 | `/shipdetail/order/unLockPayPoint` | GET | 登录 | `unlock()` |
| 验证码校验 | `/shipdetail/capture/verify` | POST | 公开 | `verify_captcha()` |

---

## 1. 班期列表

```http
GET /shipdetail/schedules/schedules
    ?scheduleType=container&page=1&pageSize=5&i18n=zh
```

| 参数 | 说明 |
|---|---|
| `scheduleType` | `container` / `roro` / `breakbulk` |
| `page` / `pageSize` | 分页 |
| `i18n` | `zh` / `en` |
| `sortBy` / `sortOrder` | 主排序 |
| `secondarySortBy` / `secondarySortOrder` | 次排序 |
| `portid` / `origin` | 起运港 ID / 名称，优先 ID |
| `dischargingPortid` / `destination` | 目的港 ID / 名称 |
| `keyword` | 船公司关键词 |
| `openDateStart` / `openDateEnd` | 开船日期范围 |
| `followedOnly` | `true` 只看关注 |

未登录：

```json
{"ok":false,"error":"NOT_LOGIN","msg":"未登录"}
```

成功：

```json
{"ok":true,"page":1,"pageSize":5,"total":9805,"data":[{
  "id":"...", "company":"...", "scheduleType":"container",
  "openPortEta":"...", "callPorts":["..."], "callPortids":["..."],
  "dist":123.4, "dischargingDist":45.6, "status":"..."
}]}
```

```python
from hifleet import HiFleetClient, schedules

client = HiFleetClient(auto_bootstrap=True)
client.set_cookies({"JSESSIONID": "...", "TGC": "..."})

result = schedules.list_schedules(
    client,
    schedule_type="container",
    page=1,
    page_size=10,
    portid="27999",
    keyword="COSCO",
)
```

## 2. 班期详情

```http
GET /shipdetail/schedules/schedules/detail?dataId={id}&i18n=zh&portid=&dischargingPortid=
```

```python
row = schedules.detail(client, data_id="123456", portid="27999")
```

## 3. 关注 / 统计 / 联想

```http
GET  /shipdetail/schedules/follows
POST /shipdetail/schedules/follows
Content-Type: application/json

{"dataId":"123456","follow":true}
```

```python
schedules.follows(client)
schedules.follow(client, "123456", follow=True)
```

统计（公开）：

```json
{"ok":true,"data":{
  "container":{"scheduleCount":9805,"companyCount":72},
  "roro":{"scheduleCount":1725,"companyCount":39},
  "breakbulk":{"scheduleCount":1119,"companyCount":73}
}}
```

港口联想（公开）：

```json
{"ok":true,"data":[
  {"portId":"27999","name":"Shanghai,CN","localName":"上海,CN",
   "country":"People's Republic Of China","code":""}
]}
```

```python
schedules.stats(client)
schedules.port_suggest(client, "Shanghai", size=8)
schedules.company_suggest(client, schedule_type="container", portid="27999", size=10)
```

## 4. 准班率

```http
GET /shipdetail/shippingScheduleAccuracy?imo=9898668
```

```python
schedules.accuracy(client, "9898668")
```

## 5. 解锁 / 支付

```http
GET /shipdetail/order/unLockPayPointQueryPrice?dataId={id}&typeCode=product_vessel_liner_charter&i18n=zh
GET /shipdetail/order/unLockPayPoint?dataId={id}&typeCode=product_vessel_liner_charter&i18n=zh
```

```python
price = schedules.unlock_price(client, "123456")
result = schedules.unlock(client, "123456")
```

## 6. 验证码

```http
POST /shipdetail/capture/verify
Content-Type: application/x-www-form-urlencoded;charset=UTF-8

ticket=...&randstr=...&authItemCode=...&i18n=zh
```

```python
from hifleet.errors import CaptchaRequired

try:
    schedules.list_schedules(client)
except CaptchaRequired as exc:
    schedules.verify_captcha(client, ticket, randstr, exc.s402)
```
