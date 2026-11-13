# 04 · 轨迹与位置

对应模块：`hifleet.track`

| 功能 | 接口 | 方法 | 鉴权 | 工具函数 |
|---|---|---|---|---|
| 船舶轨迹 | `/hifleetapi/getShipsTrajectory.do?dataType=json` | POST | 登录 | `trajectory()` |
| 轨迹包络 | `/hifleetapi/getShipsTrajectoryEnvelop.do` | POST | 登录 | `trajectory_envelop()` |
| 全量船位 | `/hifleetapi/getAllShpsJsonFacede.do` | POST | 登录 | `all_ships()` |
| 全量船位（XYZ） | `/hifleetapi/getAllShipsXYZ.do` | POST | 登录 | `all_ships_xyz()` |
| 停船点 | `/hifleetapi/getShipStopRecord.do` | POST | 登录 | `stop_records()` |
| 停泊点 | `/hifleetapi/getStopShip.do` | POST | 公开 | `stop_ships()` |
| 航迹风场 | `/hifleetapi/getwinds.do` | POST | 登录 | `winds()` |
| 某时刻吃水 | `/hifleetapi/getvygdraught.do` | POST | 登录 | `vyg_draught()` |
| 正午船位 | `/hifleetapi/gethmcnoonposition.do` | POST | 登录 | `noon_position()` |
| SDK 位置 | `api.hifleet.com/position/positions/get/token` | GET | usertoken | `sdk_positions()` |
| SDK 轨迹 | `api.hifleet.com/position/trajectory/nocompressed/token` | GET | usertoken | `sdk_trajectory()` |

---

## 1. 船舶轨迹（核心）

```http
POST /hifleetapi/getShipsTrajectory.do?dataType=json&_v=5.3.731
Content-Type: application/x-www-form-urlencoded

bbox=-180,-90,180,90&zoom=12
&starttime=2026-11-12 20:00:00&startdates=2026-11-12 20:00:00
&endates=2026-11-12 23:00:00&endtime=2026-11-12 23:00:00
&length=34&width=8&mmsi=205096000&mmsis=205096000
```

| 参数 | 说明 |
|---|---|
| `bbox` | `minLon,minLat,maxLon,maxLat` |
| `zoom` | 地图层级 |
| `starttime` / `startdates` | 开始时间，两个都传 |
| `endtime` / `endates` | 结束时间，两个都传 |
| `length` / `width` | 船长 / 船宽，用于轨迹渲染 |
| `mmsi` / `mmsis` | 单船 / 多船（逗号分隔） |

返回：

```json
{
  "status": "1",
  "data": [{
    "offers": [{"co": 204.0, "la": 51.82, "lo": 4.04, "sp": 0.0, "ti": "2026-11-12 23:00:00"}],
    "speedavg": 0.0,
    "totaldistance": 0
  }]
}
```

`offers` 缩写：`co` 航向、`la` 纬度、`lo` 经度、`sp` 航速、`ti` 时间。

```python
from hifleet import HiFleetClient, track

client = HiFleetClient(auto_bootstrap=True)
client.set_cookies({"JSESSIONID": "...", "TGC": "..."})

data = track.trajectory(
    client, "205096000",
    starttime="2026-11-12 20:00:00",
    endtime="2026-11-12 23:00:00",
    zoom=12,
)
points = data["data"][0]["offers"]
```

## 2. 轨迹包络 / 插值

| 接口 | 参数 | 说明 |
|---|---|---|
| `/hifleetapi/getShipsTrajectoryEnvelop.do` | `mmsis, startdates, enddates, zoom, bbox` | 多船轨迹包络 |
| `/khifleetapi/kgetShipsTrajectory2.do` | `mmsis, starttime, endtime, zoom, bbox` | 前端内部接口 |
| `/khifleetapi/kgetShipsTrajectory3.do?dataType=json` | 同上 + `nodp=0` | 插值轨迹 |

> `kgetShipsTrajectory2/3.do` 在 `www.hifleet.com` 直接请求返回 404，工具包不封装；优先用 `trajectory()`。

## 3. 全量船位（地图）

```http
POST /hifleetapi/getAllShpsJsonFacede.do
Content-Type: application/x-www-form-urlencoded

_source=web&id=0.123456&bbox=121,30,123,32&type=&zoom=8&devSize=10000&xyz=1
```

| 参数 | 说明 |
|---|---|
| `_source` | 来源标识，网页用 `web` |
| `id` | 随机数，防缓存 |
| `bbox` | 可视范围 |
| `type` | 船型过滤，空为全部 |
| `zoom` | 层级 |
| `devSize` | 点数限制，页面固定 `10000` |
| `xyz` | 坐标模式 |

```python
ships = track.all_ships(client, bbox=(121, 30, 123, 32), zoom=8)
```

需登录，匿名返回 `{"status":"0","msg":"NOT LOGIN"}`。

## 4. 停船点 / 停泊点

```http
POST /hifleetapi/getShipStopRecord.do

mmsi=205096000&starttime=2026-11-10 00:00:00&endtime=2026-11-12 23:00:00&zoom=5
```

需登录。公开的停泊点接口：

```http
POST /hifleetapi/getStopShip.do

mmsi=205096000&select_type=2&limit1=0&limit2=5
```

返回 XML：`<root><total>0</total></root>`。

```python
records = track.stop_records(client, "205096000", "2026-11-10 00:00:00", "2026-11-12 23:00:00")
xml_text = track.stop_ships(client, "205096000")
```

## 5. 航迹风场 / 吃水 / 正午船位

```python
track.winds(client, "205096000", "2026-11-12 00:00:00", "2026-11-13 00:00:00", zoom=5)
track.vyg_draught(client, "205096000", ti="2026-11-12 23:00:00")
track.noon_position(client, "205096000")
```

## 6. SDK 位置 / 轨迹（api.hifleet.com）

```http
GET https://api.hifleet.com/position/positions/get/token?usertoken={token}&mmsis=205096000
GET https://api.hifleet.com/position/positions/get/token?usertoken={token}&bbox=121,30,123,32&zoom=8
GET https://api.hifleet.com/position/trajectory/nocompressed/token?usertoken={token}&mmsi=...&starttime=...&endtime=...&bbox=...&zoom=...
```

缺 token 返回：

```json
{"code":500,"message":"Required String parameter 'usertoken' is not present"}
{"code":4005,"message":"token is empty."}
```

```python
positions = track.sdk_positions(client, usertoken="...", mmsis="205096000")
traj = track.sdk_trajectory(client, usertoken="...", mmsi="205096000",
                            starttime="2026-11-12 20:00:00",
                            endtime="2026-11-12 23:00:00")
```

`usertoken` 由前端 `app.bc93fdce.js` 的 `i["j"]()` 提供；匿名站点可能为空串，登录后可从页面
全局变量或请求参数中读取。

## 7. 地图瓦片

| 接口 | 参数 |
|---|---|
| `/hifleetapi/getNauticalChart.do` | `z, x, y, usertoken, _v=5.4.585` |
| `/hifleetapi/getS101Chart.do` | `z, x, y, usertoken` |
| `/hifleetapi/getOpenStreetMap.do` | `z, x, y, usertoken` |
| `/hifleetapi/getdotshipimage2.do` | `x, y, z, r, sparse=0` |
| `/hifleetapi/getdotshipimagetms.do` | `x, y, z` |
| `/hifleetapi/getdotshipimagetms6.do` | `x, y, z, sparse=10` |
| `/hifleetapi/getfleetshipimagetms6.do` | `x, y, z, sparse=10` |
| `/ukhomap/ukhoMapWms` | WMS 参数 |
