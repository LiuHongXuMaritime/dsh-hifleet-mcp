# 09 · 台风与海况（SDK）

对应模块：`hifleet.typhoon`
域名：`https://api.hifleet.com`，全部接口必须带 `usertoken`。

| 功能 | 接口 | 工具函数 |
|---|---|---|
| 当前台风列表 | `/typhoon/getcurrenttyphoonlist/token` | `list_typhoons()` |
| 台风路径点 | `/typhoon/gettyphoonposition/token` | `typhoon_positions()` |
| 台风预报 | `/typhoon/gettyphoonforecast/token` | `typhoon_forecast()` |
| 当前地震 | `/alertpoint/getrecemtearthquake/token` | `earthquakes()` |
| 海况时间列表 | `/oceanweather/getjsontimelist/token` | `ocean_time_list()` |
| 海况数值 | `/oceanweather/getjsonweathervalue/token` | `ocean_values()` |
| 风矢量 | `/oceanweather/windvector/token` | `wind_vector()` |
| 流矢量 | `/oceanweather/currentvector/token` | `current_vector()` |
| 气压矢量 | `/oceanweather/pressurevector/token` | `pressure_vector()` |
| 海浪 PNG | `/oceanweather/getoceanwavepng/token` | `ocean_wave_png_url()` |
| SDK 海图 | `/nauticalmap/token` | `nautical_tile_url()` |

缺 token 的返回：

```json
{"code":500,"message":"Required String parameter 'usertoken' is not present"}
```

---

## 1. 台风

```http
GET https://api.hifleet.com/typhoon/getcurrenttyphoonlist/token?usertoken={token}
GET https://api.hifleet.com/typhoon/gettyphoonposition/token?usertoken={token}&xuhao={编号}
GET https://api.hifleet.com/typhoon/gettyphoonforecast/token?usertoken={token}&xuhao={编号}
```

台风字段（前端缩写）：

| 字段 | 含义 |
|---|---|
| `_xuhao` | 台风编号 |
| `_name` | 名称 |
| `_lat` / `_lon` | 中心位置 |
| `_level` / `_strong` | 等级 / 强度 |
| `_pressure` | 中心气压 |
| `_windspeed` | 风速 |
| `_movedirection` / `_movespeed` | 移向 / 移速 |
| `_circle7` / `_circle10` | 7 级 / 10 级风圈 |
| `_updatetime` | 更新时间 |

```python
from hifleet import HiFleetClient, typhoon

client = HiFleetClient(auto_bootstrap=True)
current = typhoon.list_typhoons(client, usertoken="...")
positions = typhoon.typhoon_positions(client, usertoken="...", xuhao="202611")
forecast = typhoon.typhoon_forecast(client, usertoken="...", xuhao="202611")
```

## 2. 地震

```http
GET https://api.hifleet.com/alertpoint/getrecemtearthquake/token?usertoken={token}
```

```python
quakes = typhoon.earthquakes(client, usertoken="...")
```

## 3. 海况矢量 / 数值

| 接口 | 常用参数 |
|---|---|
| `/oceanweather/getjsontimelist/token` | `usertoken` |
| `/oceanweather/getjsonweathervalue/token` | `usertoken` + 时间/范围参数 |
| `/oceanweather/windvector/token` | `usertoken` + 时间/范围参数 |
| `/oceanweather/currentvector/token` | `usertoken` + 时间/范围参数 |
| `/oceanweather/pressurevector/token` | `usertoken` + 时间/范围参数 |
| `/oceanweather/getoceanwavepng/token` | `usertoken, x, y, z` |
| `/nauticalmap/token` | `usertoken, z, x, y` |

```python
times = typhoon.ocean_time_list(client, usertoken="...")
waves = typhoon.ocean_values(client, usertoken="...", params={"time": "..."})
tile = typhoon.nautical_tile_url(usertoken="...", z=6, x=48, y=34)
```

> `usertoken` 来自登录态或 SDK 授权。网页匿名状态下通常为空，需登录后从
> `localStorage` / 页面全局变量 / 网络请求参数中获取。
