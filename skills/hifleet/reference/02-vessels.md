# 02 · 船舶列表与搜索

对应模块：`hifleet.vessels`

| 接口 | 方法 | 鉴权 | 工具函数 |
|---|---|---|---|
| `/particulars/getShipDatav3` | POST JSON | 登录/风控 | `list_ships()` |
| `/particulars/getShipType` | GET | 公开 | `ship_types()` |
| `/hifleetapi/getShipSuggest.do` | POST 表单 | 公开 | `suggest()` |
| `/hifleetapi/sameShipSearch.do?dataType=json&_v=5.4.585` | POST 表单 | 公开 | `same_ship_search()` |
| `/hifleetapi/searchVesselOLByMmsi.do` | POST 表单 | 公开 | `search_vessel()` |
| `/particulars/getShipByMyFleets` | GET | 登录 | `my_fleet_ships()` |

---

## 1. 船舶列表（核心）

```http
POST /particulars/getShipDatav3
Content-Type: application/json
```

```json
{
  "offset": 0,
  "limit": 50,
  "_v": "5.3.588",
  "params": {
    "shipname": "",
    "callsign": "",
    "shiptype": "",
    "shipflag": "",
    "keyword": "",
    "mmsi": -1,
    "imo": -1,
    "shipagemin": -1,
    "shipagemax": -1,
    "loamin": -1,
    "loamax": -1,
    "dwtmin": -1,
    "dwtmax": -1,
    "sortcolumn": "shipname",
    "sorttype": "asc",
    "isFleetShip": 0
  }
}
```

| 参数 | 说明 |
|---|---|
| `offset` | 页码，从 0 开始（不是记录偏移） |
| `limit` | 每页条数 |
| `shipname` / `callsign` | 精确船名 / 呼号 |
| `shiptype` | 中文船型，如 `散货船` |
| `shipflag` | 三位船旗码，如 `CHN` |
| `keyword` | 模糊搜索词 |
| `mmsi` / `imo` | `-1` 表示不筛选 |
| `shipagemin` / `shipagemax` | 船龄范围（年） |
| `loamin` / `loamax` | 船长范围（米） |
| `dwtmin` / `dwtmax` | 载重吨范围 |
| `sortcolumn` | `shipname` `shipflag` `mmsi` `imo` `callsign` `shiptype` `yearofbuild` `LENGTH` `width` `sjdraught` `grosstonnage` `dwt` `group` |
| `sorttype` | `asc` / `desc` / `""` |
| `isFleetShip` | `0` 全部，`1` 我的船队 |

返回字段（来自前端渲染逻辑）：

| 字段 | 说明 |
|---|---|
| `ShipName` | 船名（注意大写 S） |
| `mmsi` / `imo` / `callsign` | 船舶标识 |
| `type` | 船型 |
| `YearOfBuild` | 建造年份 |
| `LENGTH` / `width` / `sjdraught` | 长 / 宽 / 设计吃水 |
| `GrossTonnage` / `dwt` | 总吨 / 载重吨 |
| `flagcode` | 船旗代码 |
| `group` | 分组（船队列表） |

```python
from hifleet import HiFleetClient, vessels

client = HiFleetClient(auto_bootstrap=True)
result = vessels.list_ships(
    client,
    offset=0,
    limit=20,
    shiptype="散货船",
    loa_min=200,
    sort_column="dwt",
    sort_type="desc",
)
print(result["total"], len(result["data"]))
```

> 匿名调用会抛 `ApiError("接口异常,请稍后重试")`；注入登录 Cookie 后恢复。
> 匿名场景可退化为解析 `/vessels/` 首屏 HTML 表格。

## 2. 船型字典

```http
GET /particulars/getShipType
```

```json
[{"type_cn":"散货船","type_en":"Bulk_carrier"},
 {"type_cn":"集装箱船","type_en":"Container_ship"}]
```

```python
types = vessels.ship_types(client)
```

## 3. 搜索联想

```http
POST /hifleetapi/getShipSuggest.do
Content-Type: application/x-www-form-urlencoded

q=MAERSK&type=1
```

```json
[{
  "_score": 50.04005,
  "callsign": "OXLT2",
  "content": "MAERSK EDINBURGH",
  "imo": "9456757",
  "mmsi": "219033000",
  "name": "MAERSK EDINBURGH",
  "t": "",
  "type": "ship"
}]
```

```python
for item in vessels.suggest(client, "MAERSK"):
    print(item["name"], item["mmsi"])
```

## 4. 同名船 / 关键词搜索

```http
POST /hifleetapi/sameShipSearch.do?dataType=json&_v=5.4.585

keyword=大连港
```

```json
{"status":"1","data":[{
  "mmsi":"414336666","name":"DAI LIANG","callsign":"BHVV","imo":"9039999",
  "type":"未知类型船舶","dwt":0,"length":190,"width":28,
  "updatetime":"-","updatetimeformat":"1541d","sameType":0
}]}
```

```python
rows = vessels.same_ship_search(client, "大连港")["data"]
```

## 5. 实时精确查询（详情页顶部）

```http
POST /hifleetapi/searchVesselOLByMmsi.do

keyword=205096000&groupName=1&i18n=zh
```

匿名可用，返回单对象。常用字段缩写：

| 字段 | 含义 | 字段 | 含义 |
|---|---|---|---|
| `m` | MMSI | `n` | 船名 |
| `i` | IMO | `c` | 呼号 |
| `an` / `fn` / `dn` | 船旗二字码 / 英文旗国 / 中文旗国 | `t` / `minotype` | 船型英文 |
| `l` / `b` / `dr` | 长 / 宽 / 吃水 | `dwt` | 载重吨 |
| `la` / `lo` | 纬度 / 经度 | `sp` / `co` / `h` | 航速 / 航迹向 / 船首向 |
| `s` | 航行状态 | `d` | 目的港 |
| `e` | ETA | `ti` | 数据时间 |
| `rot` | 转向率 | `timezone` | 时区 |
| `updatetimestamp` / `updateTimeInfo` | 更新时间戳 / “x minutes ago” | `color` / `oa`~`od` | 显示颜色 / 偏移量 |

```python
ship = vessels.search_vessel(client, "205096000")
print(ship["n"], ship["la"], ship["lo"], ship["s"])
```

## 6. 我的船队列表

```http
GET /particulars/getShipByMyFleets?offset=0&limit=50
```

返回 `{total, ShipInfo: [...]}`，需登录。

```python
rows = vessels.my_fleet_ships(client, offset=0, limit=50)
```
