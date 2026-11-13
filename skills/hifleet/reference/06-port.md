# 06 · 港口

对应模块：`hifleet.port`

| 功能 | 接口 | 方法 | 鉴权 | 工具函数 |
|---|---|---|---|---|
| 全量港口列表（含经纬度） | `/shipdetail/Portguide/indexPortList` | GET | 公开（有配额） | `index_port_list()` / `iter_ports()` / `all_ports()` / `export_ports_csv()` |
| 全量港口（SDK） | `api.hifleet.com/port/getports/token` | GET | usertoken | `sdk_all_ports()` |
| 在港船舶统计 | `/hifleetapi/getinportshipstatus.do` | GET | 公开 | `in_port_status()` |
| 预抵船舶统计 | `/hifleetapi/getarriveshipstypes.do` | GET | 公开 | `arrivals()` |
| 港口天气 | `/hifleetapi/port/weather.do` | GET | 公开 | `weather()` |
| 国家/港口联想 | `/shipdetail/Portguide/getRegion` | GET | 公开 | `region()` |
| 港口国家时区 | `/shipdetail/Portguide/getTimezoneCountry` | GET | 公开 | `timezone_country()` |
| 港口详情 | `/shipdetail/Portguide/getPortByPiuid` | GET | 公开 | `port_detail()` |
| 港口平面图 | `/shipdetail/Portguide/getPortPlanImg` | GET | 公开 | `plan_image_url()` |
| 港口气象警报 | `/shipdetail/getWeatherAlarmDataByPortcode` | GET | 公开 | `weather_alarm()` |
| OneOcean 港口 | `/shipdetail/OneOceanPorts/port/{LOCODE}` | GET | 公开 | `one_ocean_port()` |
| OneOcean 计划 | `/shipdetail/OneOceanPorts/port/{LOCODE}/plans` | GET | 公开 | `one_ocean_plans()` |
| OneOcean 搜索 | `/shipdetail/OneOceanPorts/search?name=` | GET | 公开 | `one_ocean_search()` |
| 港口留言列表 | `/hifleetapi/userMessageListAction.do` | GET | 登录 | `messages()` |
| 新增留言 | `/hifleetapi/userMessageAddAction.do` | GET | 登录 | `add_message()` |
| 删除留言 | `/hifleetapi/userMessageDeleteAction.do` | GET | 登录 | `delete_message()` |
| 编辑留言 | `/hifleetapi/userMessageEditAction.do` | GET | 登录 | `edit_message()` |
| 全球港口列表 | `api.hifleet.com/port/getports/token` | GET | usertoken | `sdk_ports()` |

---

## 0. 全量港口经纬度（重点）

```http
GET /shipdetail/Portguide/indexPortList
    ?country=&port=&page=1&results=50&facility=&format=json&type=allPorts
```

| 参数 | 说明 |
|---|---|
| `country` | 国家二字码，如 `CN`；空表示全部 |
| `port` | 港口名关键词；空表示不过滤 |
| `page` | 页码，从 1 开始 |
| `results` | 每页条数，页面可选 `10/20/50` |
| `facility` | 设施过滤，空为全部 |
| `format` | `json` |
| `type` | `allPorts` / `focusOnPorts` |

返回约 **8059** 个港口，分页大小 50 时约 162 页。单条记录包含：

```json
{
  "piuid": 1,
  "port": "Aabenraa",
  "cnname": null,
  "locode": "DK",
  "unctadPortCode": "AAB",
  "lat": "55.032667",
  "lng": "9.424333",
  "timezone": "GMT +1",
  "type": "Port",
  "portLvl": "3",
  "hasDetail": "1",
  "plansCount": "4",
  "verifiedDate": "2025-10-22",
  "seoUrl": "https://www.findaport.com/port-of-aabenraa",
  "gasfacilities": null,
  "containerfacilities": null,
  "liquidfacilities": null,
  "drybulkfacilities": null
}
```

字段说明：

| 字段 | 含义 |
|---|---|
| `piuid` | 港口内部 ID |
| `port` | 港口英文名 |
| `cnname` | 中文名（列表接口常为空） |
| `locode` | 国家二字码 |
| `unctadPortCode` | UN/LOCODE 的港口部分（可能为空） |
| `lat` / `lng` | 纬度 / 经度 |
| `timezone` | 时区 |
| `portLvl` | 港口等级 |
| `hasDetail` | 是否有详情页 |
| `plansCount` | 港口平面图数量 |
| `seoUrl` | 外部参考链接 |
| `gasfacilities` 等 | 各设施标记 |

### 配额限制（重要）

匿名连续翻页约 10 页（约 500 条）后，接口返回：

```json
{"status":"402","msg":"达到访问次数限制，需要人机校验，或24小时后重试",
 "s402":"findaport_index"}
```

这不是普通错误，而是访问配额/人机校验。工具包会抛 `CaptchaRequired`，`exc.s402` 为
`findaport_index`。**匿名一次性拉全量 8059 条不可行**，可选方案：

1. **登录后拉取**：登录态可能提高配额（`test_api.py ports --login`）。
2. **SDK 一次拉全量**：`GET https://api.hifleet.com/port/getports/token?usertoken=...`
   返回全部港口，字段为 `cnportname, country, country_cn_mame, lat, lon, portcode, portname, scale`。
3. **按国家分批**：`country=CN` 等，每批控制在配额内，分多天/多会话拉取。
4. **付费/申请 API 配额**：走官方 `api.hifleet.com` 的 AccessKey。

### 工具函数

```python
from hifleet import HiFleetClient, port

client = HiFleetClient(auto_bootstrap=True)

# 单页
page1 = port.index_port_list(client, page=1, results=50)

# 自动翻页，最多 10 页；触发配额会抛 CaptchaRequired
for row in port.iter_ports(client, page_size=50, delay=0.5, max_pages=10):
    print(row["port"], row["lat"], row["lng"])

# 拉全部（受配额限制，可能中途抛异常）
rows = port.all_ports(client, page_size=50, delay=0.5)

# 导出 CSV
port.export_ports_csv("ports.csv", rows)

# 有 usertoken 时，一次拉全量
rows = port.sdk_all_ports(client, usertoken="...")
port.export_ports_csv("ports_sdk.csv", rows, fields=port.SDK_PORT_FIELDS)
```

命令行：

```bash
python test_api.py ports --limit 100 --output ports.csv
python test_api.py ports --country CN --output ports_cn.csv
python test_api.py ports --login --output ports.csv
python test_api.py ports --sdk-token YOUR_TOKEN --output ports.csv
```

## 1. 在港船舶统计

```http
GET /hifleetapi/getinportshipstatus.do?portcode=CNSHA
```

```json
[{"锚泊":551,"靠泊":813,"在航":1970,"其他":3086}]
```

```python
from hifleet import HiFleetClient, port

client = HiFleetClient(auto_bootstrap=True)
stats = port.in_port_status(client, "CNSHA")
print(stats[0])
```

## 2. 预抵船舶统计

```http
GET /hifleetapi/getarriveshipstypes.do?portcode=CNSHA&starttime=2026-11-12 00:00:00
```

```json
[{"杂货船":"2","其他":"53","time":"2026-11-13","散货船":"19",
  "客船":"2","油船":"3","集装箱船":"25"}]
```

`starttime` 不传时默认当天 00:00:00，返回未来若干天的按船型统计。

```python
rows = port.arrivals(client, "CNSHA")
```

## 3. 港口天气

```http
GET /hifleetapi/port/weather.do?portname=Shanghai&lang=zh&action=getPortWeather
```

返回 WorldWeatherOnline 风格：

```json
{"data":{
  "request":[{"type":"City","query":"Shanghai, China"}],
  "current_condition":[{
    "temp_C":"16",
    "weatherDesc":[{"value":"Light drizzle","valueZh":"小毛毛雨"}],
    "lang_zh":[{"value":"小毛毛雨"}],
    "windspeedKmph":"6","winddir16Point":"N",
    "humidity":"82","visibility":"2","pressure":"1024","cloudcover":"100"
  }],
  "weather":[{"date":"2026-11-13","maxtempC":"...","hourly":["..."]}]
}}
```

```python
weather = port.weather(client, "Shanghai")
now = weather["data"]["current_condition"][0]
print(now["temp_C"], now["weatherDesc"][0]["valueZh"])
```

## 4. 港口联想 / 时区 / 详情

| 接口 | 参数 | 说明 |
|---|---|---|
| `GET /shipdetail/Portguide/getRegion` | `region=China` | 返回港口列表（含 `piuid, locode, portname, country, timezone, cnname...`） |
| `GET /shipdetail/Portguide/getTimezoneCountry` | `portid={piuid}` | 国家与时区 |
| `GET /shipdetail/Portguide/getPortByPiuid` | `piuid={id}` | 港口详情 |
| `GET /shipdetail/Portguide/getPortPlanImg` | `port={piuid}&format=gif&area={planId}` | 港口平面图 URL |
| `GET /shipdetail/getWeatherAlarmDataByPortcode` | `portcode=CNSHA` | 港口气象警报 |

```python
regions = port.region(client, "China")
info = port.timezone_country(client, "27999")
detail = port.port_detail(client, "27999")
img = port.plan_image_url("27999", plan_id=1)
```

## 5. OneOcean 港口数据

前缀：`/shipdetail/OneOceanPorts`，港口 ID 使用 5 位 UN/LOCODE。

| 路径 | 内容 |
|---|---|
| `/port/{LOCODE}` | 港口主数据 |
| `/port/{LOCODE}/plans` | 港口计划 |
| `/search?name={q}` | 港口搜索 |
| `/port/{LOCODE}/pilotage-requirements` | 引航要求 |
| `/port/{LOCODE}/environmental-restrictions` | 环保限制 |
| `/port/{LOCODE}/water-density` | 水密度 |
| `/port/{LOCODE}/fuels` | 燃油 |
| `/port/{LOCODE}/drydocks` | 干船坞 |
| `/port/{LOCODE}/charts` | 海图 |
| `/port/{LOCODE}/photos` | 照片 |
| `/port/{LOCODE}/vessels/stats` | 港口船舶统计 |
| `/port/{LOCODE}/terminals-berths` | 码头/泊位 |

返回可能是 `{content: "JSON字符串"}`，工具包会自动解包。

```python
data = port.one_ocean_port(client, "CNSHA")
plans = port.one_ocean_plans(client, "CNSHA")
found = port.one_ocean_search(client, "Shanghai")
```

## 6. 港口留言（需登录）

```http
GET /hifleetapi/userMessageListAction.do?type=3&identifier=CNSHA&page=1&size=10
GET /hifleetapi/userMessageAddAction.do?type=3&identifier=CNSHA&content=xxx&email=public
GET /hifleetapi/userMessageDeleteAction.do?id=123
GET /hifleetapi/userMessageEditAction.do?id=123&content=xxx&type=3&identifier=CNSHA
```

```python
port.messages(client, "CNSHA", page=1, size=10)
port.add_message(client, "CNSHA", "引航等待约 2 小时")
```

## 7. SDK 全球港口列表

```http
GET https://api.hifleet.com/port/getports/token?usertoken={token}
```

缺 token 返回 `{"code":500,"message":"Required String parameter 'usertoken' is not present"}`。

```python
ports = port.sdk_ports(client, usertoken="...")
```
