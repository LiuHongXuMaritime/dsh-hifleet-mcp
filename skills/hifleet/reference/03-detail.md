# 03 · 船舶详情与档案

对应模块：`hifleet.details`

| 功能 | 接口 | 方法 | 鉴权 | 工具函数 |
|---|---|---|---|---|
| 船舶档案 | `/hifleetapi/shiparchive/getbyimo.do` | POST | 公开（部分字段隐藏） | `get_archive()` |
| 当前航次 A | `/hifleetapi/getShipCurrentVoyageStatusAction.do` | POST | 公开 | `current_voyage()` |
| 当前航次 B | `/portofcall/getshipcurrentvoyagestatus` | POST | 公开 | `current_voyage_poc()` |
| 挂靠港 | `/portofcall/getpoc` | POST | 登录 | `port_of_call()` |
| 历史航次 | `/portofcall/queryvoyage` | POST | 登录 | `history_voyages()` |
| 近期挂靠 | `/portofcall/getrecentcall` | POST | 登录 | `recent_calls()` |
| 按 IMO 挂靠 | `/portofcall/getrecentcallbyimo` | POST | 登录 | `recent_calls_by_imo()` |
| PSC 列表 | `/particulars/psc/get` | GET | 登录 | `psc()` |
| PSC 明细 | `/particulars/psc/getDetail` | GET | 登录 | `psc_detail()` |
| 事故列表 | `/particulars/getCasualtyListByImo` | GET | 公开 | `casualty()` |
| 事故明细 | `/particulars/getCasualtyDetailByEventId` | GET | 公开 | `casualty_detail()` |
| 船舶风险 | `/shipdetail/getShipRisk` | POST | 登录 | `risk()` |
| 制裁风险 | `/shipdetail/sanction/assess/shiprisk` | POST | 权限 | `sanction_risk()` |
| 异常行为 | `/shipdetail/getAbnormalDataByMmsi` | GET | 登录 | `abnormal()` |
| 目的港 | `/hifleetapi/getDestinationByMmsi.do` | POST | 公开 | `destination()` |
| 图片（XML） | `/hifleetapi/getImageByMmsi.do` | POST | 公开 | `images()` |
| 图片（列表） | `/hifleetapi/getShipImageAction.do` | POST | 登录 | `ship_images()` |
| 船位特征 | `/hifleetapi/getShipsFeatureXml.do` | POST | 公开 | `feature_xml()` |
| 是否有档案 | `/hifleetapi/hasshipdetail.do` | POST | 公开 | `has_detail()` |
| 停泊点 | `/hifleetapi/getStopShip.do` | POST | 公开 | `stop_ships()` |
| 船舶文书 | `/hifleetapi/shiparchive/getbyimo.do` | POST | 公开 | `document()` |

---

## 1. 船舶档案

```http
POST /hifleetapi/shiparchive/getbyimo.do
Content-Type: application/x-www-form-urlencoded

imo=9898668&mmsi=205096000&_v=5.3.703
```

返回结构：

```json
{
  "status": "1",
  "msg": "success",
  "data": [{
    "key": "basicInfo",
    "labelZh": "基本信息",
    "labelEn": "Basic info",
    "value": [
      {"key": "IMO", "value": "9898668", "labelZh": "IMO", "valueZh": "9898668"},
      {"key": "ShipName", "value": "BRIGITTE", "labelZh": "船名", "valueZh": "BRIGITTE"}
    ]
  }]
}
```

12 个板块：
`basicInfo`、`ShipContactInfo`、`particularInfo`、`shipMmsiHistoryInfo`、
`shipCapacityInfo`、`shipConstructionInfo`、`shipClassSocietyInfo`、
`shipSurveyDateHistory`、`shipPowerInfo`、`shipCargoHandlingDevice`、
`managementInfo`、`Businesshistory`。

`basicInfo` 字段：
`IMO`、`MMSI`、`ShipName`、`Callsign`、`Type`、`FlagName`、`FlagEffectiveDate`、
`PortofRegistry`、`ShipStatus`、`Speed`、`SpeedMax`、`SpeedService`、
`LastUpdateDate`、`TypeCII`。

```python
from hifleet import HiFleetClient, details

client = HiFleetClient(auto_bootstrap=True)
archive = details.get_archive(client, imo="9898668", mmsi="205096000")
basic = next(s for s in archive["data"] if s["key"] == "basicInfo")
print({item["key"]: item["value"] for item in basic["value"]})
```

> 匿名时除 `basicInfo` 外，其它板块常返回 `******`。

## 2. 当前航次

```http
POST /hifleetapi/getShipCurrentVoyageStatusAction.do

mmsi=205096000
```

```json
{"status":1,"data":{
  "showModel":2,"startport":"Harlingen[Netherlands]","startportcode":"NLHAR",
  "starttime":"2026-09-20 23:15","endport":"","endtime":"","speedStr":"",
  "status":"机动船在航","stopAction":"停泊",
  "stoppedHourAction":"停","stoppedHourFormat":"46d2h",
  "updatetime":"2026-11-12 23:26:22"
}}
```

`showModel=1` 在航，`2` 停泊/锚泊。

另一种返回结构：

```http
POST /portofcall/getshipcurrentvoyagestatus

mmsi=205096000&i18n=zh
```

```json
{"result":"OK","num":1,"list":{"showModel":2,"startport":"Harlingen[Netherlands]", "...": "..."}}
```

```python
voyage = details.current_voyage(client, "205096000")
print(voyage["data"]["status"])
```

## 3. 挂靠港 / 历史航次（需登录）

```http
POST /portofcall/getpoc

mmsi=205096000&starttime=2025-11-12 00:00:00&endtime=2026-11-12 23:00:00
&limit1=0&limit2=10&transfertolocaltime=1&accuracyval=5
```

| 参数 | 说明 |
|---|---|
| `mmsi` / `imo` | 二选一 |
| `starttime` / `endtime` | `yyyy-MM-dd HH:mm:ss` |
| `limit1` / `limit2` | 起止序号 |
| `transfertolocaltime` | 是否转本地时间，固定 `1` |
| `accuracyval` | 精度，页面固定 `5` |

```python
poc = details.port_of_call(
    client, mmsi="205096000",
    starttime="2025-11-12 00:00:00",
    endtime="2026-11-12 23:00:00",
)
print(poc["total"])
```

历史航次：

```http
POST /portofcall/queryvoyage

mmsi=&starttime=&endtime=&offset=0&limit=10&accuracyval=5
```

返回字段：`startport`、`startportcnname`、`startportcountryname`、
`startportinitialdraught`、`startportrestartdraught`、`starttime`、
`endport`、`endportcnname`、`endportcountryname`、`draught`、`endtime`。

```python
voyages = details.history_voyages(client, mmsi="205096000",
                                  starttime="2025-11-12 00:00:00",
                                  endtime="2026-11-12 23:00:00")
```

## 4. PSC（需登录）

```http
GET /particulars/psc/get?imo=9898668
GET /particulars/psc/getDetail?uid={uid}
```

未登录：`{"status":"0","msg":"NOT LOGIN"}`。

列表字段：`MouType`、`shipname`、`flag`、`shiptype`、`DataOfInspection`、
`PortOfInspection`、`TypeOfInspection`、`NumberOfDeficiencies`、`Detention`、
`RiskProfile`、`window`。

```python
psc_rows = details.psc(client, "9898668")
```

## 5. 事故 / 事件（公开）

```http
GET /particulars/getCasualtyListByImo?imo=9898668
GET /particulars/getCasualtyDetailByEventId?eventId=906754
```

```json
{"status":"1","data":[{
  "eventId":906754,"imo":"9898668","shipName":"BRIGITTE",
  "eventType":"Ship Casualties","eventGroup":"Hull / Machinery Damage",
  "detail":"Hull / Machinery Damage","significance":"Serious",
  "startDate":"2025-01-31","endDate":"2025-01-31",
  "totalLoss":"No","pollution":"No","summaryText":"..."
}],"total":3}
```

```python
events = details.casualty(client, "9898668")
detail = details.casualty_detail(client, 906754)
```

## 6. 风险 / 制裁

| 接口 | 参数 | 返回 |
|---|---|---|
| `POST /shipdetail/getShipRisk` | `imo` | `{score, risk_level}`，`score>=45` 高风险 |
| `POST /shipdetail/sanction/assess/shiprisk` | `imonumber` | `riskLevel`: `0` 低 / `1` 中 / `2` 高 |
| `GET /shipdetail/getAbnormalDataByMmsi` | `mmsi, from, size` | 异常行为列表 |

```python
risk = details.risk(client, "9898668")
alerts = details.abnormal(client, "205096000", offset=0, size=10)
```

## 7. 图片

```http
POST /hifleetapi/getImageByMmsi.do

nownum=0&mmsi=205096000&limit=1
```

返回 XML：

```xml
<root>
  <previmage><imageindex>null</imageindex>...</previmage>
  <nextimage>...</nextimage>
  <nowimages><nowimage>...</nowimage></nowimages>
</root>
```

```python
xml_text = details.images(client, "205096000")
```

`getShipImageAction.do` 返回 JSON 图片列表，但需要登录。

## 8. 其他

```python
details.destination(client, "205096000")      # 目的港（含经纬度/时区）
details.feature_xml(client, "205096000")      # 船位 XML
details.has_detail(client, imo="9898668")     # <check isexists="0"/>
details.stop_ships(client, "205096000")       # 停泊点 XML
details.document(client, mmsi="205096000", imo="9898668")
```
