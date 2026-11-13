# 08 · 船队与账号

对应模块：`hifleet.fleet`

| 功能 | 接口 | 方法 | 鉴权 | 工具函数 |
|---|---|---|---|---|
| 船队船舶 | `/hifleetapi/queryMyFleetsShips.do` | POST | 登录 | `my_ships()` |
| 分组列表 | `/hifleetapi/getMyFleetsListAction.do` | POST | 登录 | `groups()` |
| 加入多分组 | `/hifleetapi/addFleet2MultiGroup.do` | POST | 登录 | `add_to_group()` |
| 删除分组/船舶 | `/hifleetapi/deleteFleetAndGroup.do` | POST | 登录 | `remove_ship()` |
| 登录状态 | `/hifleetapi/loginstatus.do` | GET | — | `login_status()` |
| 退出 | `/hifleetapi/userLogOut.do` | POST | 登录 | `logout()` |
| 用户权限 | `/hifleetapi/getUserRightJson.do` | POST | 登录 | `rights()` |
| 生效权限 | `/service-auth/getUserEffectiveAuths` | GET | 登录 | `effective_auths()` |
| 船舶报告 | `/publicapi/vesselreport/query` | POST | 权限 | `vessel_report()` |
| 报告类型 | `/publicapi/vesselreport/list/types` | POST | 权限 | `vessel_report_types()` |
| 删除报告 | `/publicapi/vesselreport/delete` | POST | 权限 | `vessel_report_delete()` |

---

## 1. 船队船舶

```http
POST /hifleetapi/queryMyFleetsShips.do

mmsis=&_source=web
```

`mmsis` 为空表示全部船队船舶；多个 MMSI 用逗号分隔。

返回 `{status, msg, data:[...], bigFleet}`，字段与 `searchVesselOLByMmsi` 类似。

```python
from hifleet import HiFleetClient, fleet

client = HiFleetClient(auto_bootstrap=True)
client.set_cookies({"JSESSIONID": "...", "TGC": "..."})

result = fleet.my_ships(client)
print(result["total"], len(result["data"]))
```

## 2. 分组

```http
POST /hifleetapi/getMyFleetsListAction.do
```

返回分组数组，元素含 `name`、`color` 等。

```python
groups = fleet.groups(client)
```

加入分组：

```http
POST /hifleetapi/addFleet2MultiGroup.do

mmsi=205096000&name=BRIGITTE&callsign=OPAS
&checkedgroup=关注船&uncheckedgroup=其他分组
```

```python
fleet.add_to_group(client, mmsi="205096000", name="BRIGITTE",
                   callsign="OPAS", checked_group="关注船")
```

删除分组/船舶：

```http
POST /hifleetapi/deleteFleetAndGroup.do

group=关注船&mmsiarr=205096000&id=2
```

```python
fleet.remove_ship(client, mmsi="205096000", group="关注船")
```

> 其余船队接口参数较杂（`updateFleetGroupColor`、`updatefleetgroupname`、
> `fleetShipEdit` 等），工具包只封装了参数已确认的三个，避免瞎猜。

## 3. 登录状态与权限

```python
fleet.login_status(client)      # /hifleetapi/loginstatus.do
fleet.logout(client)            # /hifleetapi/userLogOut.do
fleet.rights(client)            # /hifleetapi/getUserRightJson.do
fleet.effective_auths(client)   # /service-auth/getUserEffectiveAuths
```

登录与本地会话：

```python
from hifleet import login, ensure_login, logout, session_status

login(client, "your@email.com", "password")   # 首次登录，保存到 ~/.hifleet/session.json
ensure_login(client, username="your@email.com", password="password")  # 失效自动重登
logout(client)                                 # 退出并删除会话

# 也可只从浏览器复制 Cookie
client.set_cookies({"JSESSIONID": "...", "TGC": "..."})
```

## 4. 船舶报告

```http
POST /publicapi/vesselreport/query

mmsi=205096000&userName=&reportType=&startTime=&endTime=
&order=desc&offset=0&limit=5
```

| 参数 | 说明 |
|---|---|
| `mmsi` | MMSI |
| `userName` | 用户名，可空 |
| `reportType` | 报告类型，空为全部 |
| `startTime` / `endTime` | 时间范围 |
| `order` | `desc` / `asc` |
| `offset` / `limit` | 分页 |

```python
rows = fleet.vessel_report(client, mmsi="205096000", limit=5)
types = fleet.vessel_report_types(client)
fleet.vessel_report_delete(client, report_id=123)
```

> 船舶报告接口需要相应数据权限，普通账号可能返回空或 `无权限操作`。
