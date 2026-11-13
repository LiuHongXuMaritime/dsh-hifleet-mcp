# 05 · 航线与气象

对应模块：`hifleet.route`

| 功能 | 接口 | 方法 | 鉴权 | 工具函数 |
|---|---|---|---|---|
| 气象航线 | `/hifleetrouteapi/getNewRouteForWeather` | POST | 公开 | `weather_route()` |
| 点到点距离 | `/hifleetrouteapi/GetPoint2PointRoute.do` | POST | 公开 | `point_to_point()` |
| 航线列表 | `/hifleetapi/getroute.do` | POST | 登录 | `plan_routes()` |
| 保存航线 | `/hifleetapi/saveRouteReturnJson.do` | POST | 登录 | `save_route()` |
| 更新航线 | `/hifleetapi/updateroute.do` | POST | 登录 | `update_route()` |
| 删除航线 | `/hifleetapi/deleteRoutePlanAction.do` | POST | 登录 | `delete_route()` |
| 沿航线时间 | `/hifleetapi/getHangxianDate.do` | POST | 公开 | `hangxian_date()` |
| 沿航线浪高 | `/hifleetapi/getHangxianWave.do` | POST | 公开 | `hangxian_wave()` |
| 沿航线风场 | `/hifleetapi/getHangxianWind.do` | POST | 公开 | `hangxian_wind()` |
| 沿航线天气明细 | `/hifleetapi/getHangxianWeatherDetail.do` | POST | 公开 | `hangxian_weather()` |
| 天气数值明细 | `/hifleetapi/getWeatherValueDetail.do` | POST | 公开 | `weather_values()` |
| 航迹天气点 | `/hifleetapi/getWeather.do` | POST | 公开 | `weather()` |
| 涌浪方向 | `/hifleetapi/getRouteSwellDirection.do` | POST | 公开 | `swell_direction()` |
| 潮汐 | `/hifleetweatherapi/getTideDateforwechat.do` | POST | 公开 | `tide()` |

---

## 1. 气象航线（核心）

```http
POST /hifleetrouteapi/getNewRouteForWeather?i18n=zh&_v=5.4.585
Content-Type: application/x-www-form-urlencoded

start=121.666667,38.916667
&end=121.6147,31.36636
&viewpoint=139.793414,35.599839;135.4333,34.65
&starttime=2026-11-11 23:12:52
&wavevlue=5
&speed=10
&ecashortest=1
&arcticroute=1
```

| 参数 | 说明 |
|---|---|
| `start` | 起点 `lon,lat` |
| `end` | 终点 `lon,lat` |
| `viewpoint` | 途经点，`lon,lat;lon,lat`，可空 |
| `starttime` | 起航时间 `yyyy-MM-dd HH:mm:ss` |
| `wavevlue` | 浪高阈值（源码就是这个拼写） |
| `speed` | 航速（节） |
| `ecashortest` | 是否走最短 ECA 区域，`1/0` |
| `arcticroute` | 是否允许北极航线，`1/0` |

返回：

```json
{
  "status": "success",
  "start": "121.666667,38.916667",
  "end": "121.6147,31.36636",
  "viewpoint": "139.793414,35.599839;135.4333,34.65",
  "nmile": 2302,
  "waypoints": [{
    "dis": 1165.4,
    "ecadis": 1165.4,
    "ecalist": [{"name":"SUMMER ZONE","ename":"SUMMER ZONE","dis":1165.4}],
    "piracydis": 0,
    "piracylist": [],
    "wordloaddis": 0,
    "worldloadlist": [],
    "route_id": 0,
    "waypoints": [[121.666667,38.916667], [121.7085,38.9245], "..."]
  }],
  "passAvoidArea": [{
    "areaid": 702, "name": "关门海峡", "ename": "Kanmon Straits",
    "wait_hour": 0, "gis": "POLYGON((...))"
  }],
  "multwaypoints": []
}
```

`waypoints` 是分段数组（起点→途经点、途经点→途经点、途经点→终点），每段带 ECA、
海盗区、战争区距离。

```python
from hifleet import HiFleetClient, route

client = HiFleetClient(auto_bootstrap=True)
result = route.weather_route(
    client,
    start=(121.666667, 38.916667),
    end=(121.6147, 31.36636),
    starttime="2026-11-11 23:12:52",
    viewpoint=[(139.793414, 35.599839), (135.4333, 34.65)],
    wave_height=5,
    speed=10,
)
print(result["nmile"])
points = route.flatten_waypoints(result)
```

## 2. 点到点航线

```http
POST /hifleetrouteapi/GetPoint2PointRoute.do

start=121.666667,38.916667&end=121.6147,31.36636
```

```json
{
  "status": "success", "nmile": 536.3, "ecadistance": 0,
  "route_id": 22091, "login": true,
  "waypoints": [[121.666667,38.916667], "...", [121.6147,31.36636]],
  "waitArea": [{"areaid":3,"name":"长江口","ename":"chang jiang ko","wait_hour":24,"gis":"POLYGON((...))"}],
  "waitHour": 24,
  "passAvoidArea": [], "key": ""
}
```

```python
leg = route.point_to_point(client, (121.666667, 38.916667), (121.6147, 31.36636))
print(leg["nmile"], leg["waitHour"])
```

## 3. 航线计划

| 接口 | 参数 | 说明 |
|---|---|---|
| `POST /hifleetapi/getroute.do` | `mmsi, limit1, limit2` | 航线列表（登录） |
| `POST /hifleetapi/saveRouteReturnJson.do` | `points, name, mmsi_bak` | 保存航线 |
| `POST /hifleetapi/updateroute.do` | `routeid, showflg, mmsi` | 更新/显示 |
| `POST /hifleetapi/deleteRoutePlanAction.do` | `id` | 删除 |
| `POST /hifleetapi/getFleetsAllPlanRoutes.do` | — | 船队全部计划 |
| `POST /recommendation/destination` | `destination, mmsi, imo` | 目的港推荐 |

```python
plans = route.plan_routes(client, "205096000", limit1=0, limit2=3)
route.save_route(client, points="lon,lat;lon,lat", name="Shanghai-Ningbo", mmsi="205096000")
route.update_route(client, route_id=12345, mmsi="205096000", show=True)
route.delete_route(client, 12345)
```

## 4. 沿航线气象

| 接口 | 参数 |
|---|---|
| `/hifleetapi/getHangxianDate.do` | `mmsi, zoom` |
| `/hifleetapi/getHangxianWave.do` | `mmsi, zoom` |
| `/hifleetapi/getHangxianWind.do` | `mmsi, zoom` |
| `/hifleetapi/getHangxianWeatherDetail.do` | `page, size, mmsi` |
| `/hifleetapi/getWeatherValueDetail.do` | `page, size, mmsi, starttime, endtime` |
| `/hifleetapi/getWeather.do` | `zoom, mmsi, starttime, endtime` |
| `/hifleetapi/getRouteSwellDirection.do` | `zoom, mmsi` |

```python
route.hangxian_wave(client, "205096000", zoom=5)
route.hangxian_weather(client, "205096000", page=1, size=100)
route.weather(client, "205096000", "2026-11-12 00:00:00", "2026-11-13 00:00:00", zoom=5)
```

`getWeather.do` 返回数组，每个点是航迹上的天气采样：

```json
[{
  "endlat": "51.820633", "endlon": "4.040022", "endtime": "2026-11-12 00:00:01",
  "currentDirection": "", "currentSpeed": "", "gustknot": "",
  "waveheight": "...", "winddirection": "...", "windspeed": "..."
}]
```

## 5. 天气瓦片 / 粒子（/hfWeatherApi）

公共参数：`time={time}&f={forecast}`；登录后附加 `usertoken`。
GIF/PNG 瓦片：`z={z}&x={x}&y={y}`。

| 类别 | 接口 |
|---|---|
| 风 | `/hfWeatherApi/GetWind`、`getWindParticle`、`getWindGratingPicture`、`getWindGrayPicture`、`getWindGratingPicture3594`、`getWindGratingPicture3420`、`getWindGratingPictureJson3594`、`getWindGratingPictureJson3420` |
| 洋流 | `/hfWeatherApi/GetCurrent`、`getCurrentParticle`、`getCurrentParticle3865`、`getCurrentGratingPicture`、`getNewCurrentGratingPicture`、`getCurentGratingPicture3859?datatype=3857`、`getCurentGratingPictureJson3859?datatype=3857` |
| 浪 | `/hfWeatherApi/getWavePNG`、`getWaveParticle`、`getWaveGratingPicture`、`getNewWaveGratingPicture`、`getWaveDirection`、`getSwellDirection`、`getWaveContourPicture`、`getWaveIsosurface3583` |
| 海冰 | `/hfWeatherApi/getIceGratingPicture`、`getIceSiconcGratingPicture` |
| 能见度 | `/hfWeatherApi/getVisibilityGratingPicture` |
| 等值线 | `/hfWeatherApi/GetIsoline` |
| 图例配置 | `/hfWeatherApi/getWeatherConfig`、`/hpopup/n4678.json` |
| 天气底图 | `/hfWeatherWaveApi/hlandmap`、`/hfWeatherWaveApi/darklandmap` |

## 6. 潮汐

```http
POST /hifleetweatherapi/getTideDateforwechat.do

lon=121.5&lat=31.2
```

```python
tide = route.tide(client, 121.5, 31.2)
```
