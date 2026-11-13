# 10 · 鉴权矩阵与已知坑

## 1. 匿名可访问（均已实测）

| 模块 | 接口 |
|---|---|
| 船舶 | `/particulars/getShipType`、`/hifleetapi/getShipSuggest.do`、`/hifleetapi/sameShipSearch.do`、`/hifleetapi/searchVesselOLByMmsi.do` |
| 档案 | `/hifleetapi/shiparchive/getbyimo.do`（部分字段 `******`）、`/hifleetapi/hasshipdetail.do`、`/hifleetapi/getShipsFeatureXml.do` |
| 航次 | `/hifleetapi/getShipCurrentVoyageStatusAction.do`、`/portofcall/getshipcurrentvoyagestatus`、`/hifleetapi/getDestinationByMmsi.do` |
| 事故 | `/particulars/getCasualtyListByImo`、`/particulars/getCasualtyDetailByEventId` |
| 图片 | `/hifleetapi/getImageByMmsi.do`（XML） |
| 停泊 | `/hifleetapi/getStopShip.do`（XML） |
| 气象 | `/hifleetapi/getWeather.do`、`/hifleetapi/getHangxianDate.do`（空数组）、`/hifleetapi/getHangxianWave.do`（空数组）、`/hifleetapi/port/weather.do` |
| 航线 | `/hifleetrouteapi/getNewRouteForWeather`、`/hifleetrouteapi/GetPoint2PointRoute.do` |
| 港口 | `/hifleetapi/getinportshipstatus.do`、`/hifleetapi/getarriveshipstypes.do`、`/shipdetail/Portguide/getRegion`、`/shipdetail/Portguide/getTimezoneCountry`、`/shipdetail/Portguide/getPortByPiuid`、`/shipdetail/Portguide/getPortPlanImg`、`/shipdetail/Portguide/indexPortList`（约 500 条后触发配额）、`/shipdetail/getWeatherAlarmDataByPortcode`、`/shipdetail/OneOceanPorts/*` |
| 班期 | `/shipdetail/schedules/stats`、`/shipdetail/schedules/ports/suggest`、`/shipdetail/shippingScheduleAccuracy` |
| 其他 | `/hifleetapi/getTotalShipNum.do`（匿名返回 0） |

## 2. 需登录

| 模块 | 接口 |
|---|---|
| 列表 | `/particulars/getShipDatav3`（分页）、`/particulars/getShipByMyFleets` |
| 轨迹 | `/hifleetapi/getShipsTrajectory.do`、`/hifleetapi/getShipsTrajectoryEnvelop.do`、`/hifleetapi/getAllShpsJsonFacede.do`、`/hifleetapi/getAllShipsXYZ.do`、`/hifleetapi/getShipStopRecord.do` |
| 航线 | `/hifleetapi/getroute.do`、`/hifleetapi/saveRouteReturnJson.do`、`/hifleetapi/updateroute.do`、`/hifleetapi/deleteRoutePlanAction.do` |
| 挂靠 | `/portofcall/getpoc`、`/portofcall/queryvoyage`、`/portofcall/getrecentcall`、`/portofcall/getrecentvoyage` |
| 风险 | `/particulars/psc/get`、`/particulars/psc/getDetail`、`/shipdetail/getShipRisk`、`/shipdetail/getAbnormalDataByMmsi` |
| 图片 | `/hifleetapi/getShipImageAction.do` |
| 船队 | `/hifleetapi/queryMyFleetsShips.do`、`/hifleetapi/getMyFleetsListAction.do`、`/hifleetapi/addFleet2MultiGroup.do`、`/hifleetapi/deleteFleetAndGroup.do` |
| 班期 | `/shipdetail/schedules/schedules`、`/shipdetail/schedules/schedules/detail`、`/shipdetail/schedules/follows`、`/shipdetail/schedules/companies/suggest` |
| 用户 | `/hifleetapi/loginstatus.do`、`/hifleetapi/getUserRightJson.do`、`/service-auth/getUserEffectiveAuths` |

登录态：Cookie `JSESSIONID` + `TGC`。

## 3. 需权限 / 白名单

| 接口 | 表现 |
|---|---|
| `/shipdetail/sanction/assess/shiprisk` | `{"status":"0","msg":"无权限操作"}` |
| `/publicapi/vesselreport/*` | 需要船舶报告权限 |
| `/ukhomap/*` | 需要 UKHO 授权 |
| `/shipdetail/routerisk` | 需要风险模块权限 |

## 4. 需 usertoken（api.hifleet.com）

`/position/*`、`/port/getports/token`、`/typhoon/*`、`/oceanweather/*`、
`/alertpoint/*`、`/nauticalmap/token`。

缺 token：

```json
{"code":500,"message":"Required String parameter 'usertoken' is not present"}
{"code":4005,"message":"token is empty."}
```

## 5. 已验证的坑

1. **`getShipDatav3` 匿名报“接口异常”**
   列表页首屏由服务端直出 HTML，JavaScript 分页才走该接口；匿名请求会返回
   `{"status":"0","msg":"接口异常,请稍后重试"}`。

2. **HTTP 200 也可能是未登录**
   很多接口返回 200 + `{"msg":"未登录"}`，不能只看状态码。工具包已统一识别。

3. **402 / S402 是验证码**
   不是业务错误。`s402` 字段就是 `authItemCode`，过码后调
   `/shipdetail/capture/verify` 再重试。

4. **`wavevlue` 拼写**
   气象航线的浪高参数是 `wavevlue`，写 `wavevalue` 会被忽略。

5. **`kgetShipsTrajectory2/3.do` 404**
   在 `www.hifleet.com` 直接请求不存在，使用 `/hifleetapi/getShipsTrajectory.do`。

6. **档案匿名字段被隐藏**
   仅 `basicInfo` 可见，其余为 `******`。

7. **班期统计与港口联想公开，但班期列表要登录**
   `stats`、`ports/suggest` 可匿名；`schedules`、`schedules/detail` 不行。

8. **`_v` 不是统一必填**
   多数接口不校验；列表、档案、轨迹、航线分别使用 `5.3.588`、`5.3.703`、
   `5.3.731`、`5.4.585`。

## 6. 逆向来源

| 文件 | 内容 |
|---|---|
| `https://static.hifleet.com/new/dist/js/app.bc93fdce.js` | 地图/航线 SPA 的接口注册表与全部参数 |
| `/particular-static/vessel3/js/particular-list.js` | 列表、联想、验证码 |
| `/particular-static/vessel3/js/particular-detail.js` | 详情、PSC、事故、风险、挂靠、图片 |
| `/particular-static/js/portindex.js` | 港口列表天气、在港、预抵 |
| `/particular-static/js/G_Detail.js`、`port-detail-oneocean.js`、`port-oneocean-data.js` | 港口详情、OneOcean |
| `/shipdetail/schedule-static/app.js` | 班轮全部接口 |
| `/hpopup/n4678.json` | 天气图例配置 |
