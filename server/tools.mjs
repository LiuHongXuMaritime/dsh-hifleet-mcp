/**
 * HiFleet MCP 全功能工具（Node 版）。
 *
 * 设计：按模块聚合工具，action + params 由 shared/actions.json 驱动；
 * 详细参数放在 skills/hifleet/reference/*.md，Agent 按需读取。
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { HiFleetClient, HiFleetError } from "./client.mjs";
import { loadEnv } from "./env.mjs";

loadEnv();

const PLUGIN_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const REGISTRY = JSON.parse(
  fs.readFileSync(path.join(PLUGIN_ROOT, "shared", "actions.json"), "utf8"),
);

class ToolError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ToolError";
    this.code = code;
    this.message = message;
  }
}

function readDshCredentials() {
  // DSH 设置项补丁：账号密码保存在 ~/.hifleet/credentials.json（HIFLEET_CREDENTIALS
  // 可覆盖路径），设置页保存后无需重启即可在下一次工具调用时自动登录。
  const override = process.env.HIFLEET_CREDENTIALS;
  const file =
    typeof override === "string" && override.trim() !== ""
      ? path.resolve(override.trim())
      : path.join(os.homedir(), ".hifleet", "credentials.json");
  try {
    // 兼容记事本等编辑器保存时写入的 UTF-8 BOM。
    const raw = JSON.parse(
      fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""),
    );
    if (!raw || typeof raw !== "object") return null;
    const username = typeof raw.username === "string" ? raw.username.trim() : "";
    const password = typeof raw.password === "string" ? raw.password : "";
    if (username === "" || password === "") return null;
    return {
      username,
      password,
      savedAt: typeof raw.savedAt === "string" ? raw.savedAt : null,
    };
  } catch {
    return null;
  }
}

let singleton = null;
let authPromise = null;
let authError = null;
let lastCredentialsKey = null;

export function getClient() {
  if (!singleton) {
    singleton = new HiFleetClient();
    singleton.loadSession();
  }
  return singleton;
}

function credentialsKey(saved) {
  if (!saved) return null;
  return `${saved.username}\u0000${saved.password}\u0000${saved.savedAt || ""}`;
}

async function ensureAuth() {
  // DSH 适配补丁：每次鉴权前重读磁盘上的会话文件。
  // 这样在 DSH 运行期间用 login.cmd / login.mjs / 设置页完成登录后，
  // 下一次工具调用就会使用新会话（上游 2.1.1 只在进程启动时读取一次）。
  const client = getClient();
  client.loadSession();

  // DSH 设置项补丁：设置页保存的账号密码（~/.hifleet/credentials.json）。
  const saved = readDshCredentials();

  // 凭据变化（换账号或改密码，savedAt 也会变）→ 丢掉进程内旧登录态，
  // 强制下一次调用重新登录；否则已登录的进程会一直沿用旧会话。
  const key = credentialsKey(saved);
  if (key !== lastCredentialsKey) {
    lastCredentialsKey = key;
    if (key !== null) {
      client.resetAuth();
      authPromise = null;
      authError = null;
    }
  }

  if (process.env.HIFLEET_AUTO_LOGIN === "0") return;
  if (authPromise) return authPromise;
  let loggedIn = false;
  authPromise = (async () => {
    const status = await client.status();
    if (status.loggedIn) {
      loggedIn = true;
      return;
    }

    const username = process.env.HIFLEET_USERNAME || (saved && saved.username);
    const password = process.env.HIFLEET_PASSWORD || (saved && saved.password);
    if (!username || !password) return;

    try {
      await client.login(username, password);
      client.saveSession(username);
      loggedIn = true;
      authError = null;
    } catch (error) {
      authError = {
        error: error.code || "LOGIN_FAILED",
        message: error.message || String(error),
      };
    }
  })();
  try {
    await authPromise;
  } finally {
    // 始终释放 in-flight 缓存：下一次调用会重新 status()，
    // 从而感知会话过期与设置页保存的新凭据。
    authPromise = null;
  }
}

function pick(source, keys) {
  const target = {};
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null) {
      target[key] = source[key];
    }
  }
  return target;
}

function downsample(items, maxItems) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const step = Math.max(1, Math.ceil(items.length / maxItems));
  return items.filter(
    (_, index) => index % step === 0 || index === items.length - 1,
  );
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTime(value) {
  if (typeof value === "string") return value;
  if (value instanceof Date) {
    return (
      `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ` +
      `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
    );
  }
  return value;
}

function prepare(moduleName, args) {
  const moduleSpec = REGISTRY[moduleName];
  if (!moduleSpec) {
    throw new ToolError("UNKNOWN_MODULE", `未知模块: ${moduleName}`);
  }
  const spec = moduleSpec.actions?.[args.action];
  if (!spec) {
    throw new ToolError(
      "UNKNOWN_ACTION",
      `${moduleName} 不支持 action: ${args.action}`,
    );
  }
  if (spec.write && args.confirm !== true) {
    throw new ToolError(
      "CONFIRM_REQUIRED",
      `${moduleName}.${args.action} 是写操作，必须在 params 同级传 confirm=true`,
    );
  }

  const params = args.params || {};
  if (typeof params !== "object" || Array.isArray(params)) {
    throw new ToolError("INVALID_ARGUMENT", "params 必须是对象");
  }

  const data = { ...(spec.defaults || {}), ...params };
  for (const key of spec.format_time || []) {
    if (data[key]) data[key] = formatTime(data[key]);
  }

  let endpoint = spec.path;
  const placeholders = [...endpoint.matchAll(/\{(\w+)\}/g)].map(
    (match) => match[1],
  );
  for (const placeholder of placeholders) {
    if (!(placeholder in data)) {
      throw new ToolError(
        "INVALID_ARGUMENT",
        `缺少路径参数: ${placeholder}`,
      );
    }
    endpoint = endpoint.replace(`{${placeholder}}`, String(data[placeholder]));
    delete data[placeholder];
  }
  return { spec, data, endpoint };
}

function shape(spec, payload) {
  const rowsKey = spec.rows;
  if (rowsKey && payload && typeof payload === "object" && !Array.isArray(payload)) {
    let rows = payload[rowsKey] || [];
    if (Array.isArray(rows) && spec.pick) {
      rows = rows.map((row) => pick(row, spec.pick));
    }
    return { ...payload, [rowsKey]: rows };
  }
  if (spec.pick && payload && typeof payload === "object" && !Array.isArray(payload)) {
    return pick(payload, spec.pick);
  }
  return payload;
}

async function requestSpec(spec, data, endpoint) {
  const client = getClient();
  const method = spec.method || "GET";
  const body = spec.body || "query";
  const check = (spec.expect || "auto") !== "text";
  const baseUrl = spec.base === "sdk" ? client.sdkUrl : undefined;

  if (spec.token) {
    const token = data.usertoken || client.usertoken;
    if (!token) throw new HiFleetError("SDK_TOKEN_REQUIRED", "缺少 usertoken");
    data.usertoken = token;
  }

  const options = {
    baseUrl,
    referer: baseUrl
      ? `${client.baseUrl}/web/?i18n=${client.language}`
      : undefined,
    check,
  };

  let payload;
  if (body === "query") payload = await client.get(endpoint, data, options);
  else if (body === "json") payload = await client.postJson(endpoint, data, options);
  else payload = await client.postForm(endpoint, data, options);

  return shape(spec, payload);
}

// ---------------------------------------------------------------- handlers
async function archiveHandler(spec, data, endpoint) {
  const payload = await getClient().postForm(endpoint, data);
  const sections = Array.isArray(payload.data) ? payload.data : [];
  const basic = sections.find((section) => section.key === "basicInfo") || {};
  const basicMap = {};
  for (const field of basic.value || []) {
    if (field.key) basicMap[field.key] = field.value;
  }
  const result = {
    ship: pick(basicMap, [
      "IMO", "MMSI", "ShipName", "Callsign", "Type", "FlagName",
      "FlagEffectiveDate", "PortofRegistry", "ShipStatus", "Speed",
      "SpeedMax", "SpeedService", "LastUpdateDate", "TypeCII",
    ]),
    sections: sections.map((section) => ({
      key: section.key,
      label: section.labelZh,
      fieldCount: (section.value || []).filter((field) => field.key).length,
    })),
  };
  if (data.verbose === true) result.raw = payload;
  return result;
}

async function trajectoryHandler(spec, data, endpoint) {
  const maxPoints = Math.max(10, Math.min(2000, Number(data.max_points) || 500));
  delete data.max_points;
  const mmsi = data.mmsi;
  const mmsis = data.mmsis || mmsi;
  if (!mmsis) throw new ToolError("INVALID_ARGUMENT", "需要 mmsi 或 mmsis");
  data.mmsis = mmsis;
  if (!data.bbox) data.bbox = "-180,-90,180,90";
  if (!data.zoom) data.zoom = 8;
  if (data.starttime && !data.startdates) data.startdates = data.starttime;
  if (data.endtime && !data.endates) data.endates = data.endtime;

  const payload = await getClient().postForm(endpoint, data);
  const first = (payload.data || [{}])[0] || {};
  const offers = Array.isArray(first.offers) ? first.offers : [];
  const points = downsample(offers, maxPoints).map((point) =>
    pick(point, ["ti", "la", "lo", "sp", "co"]),
  );
  return {
    count: offers.length,
    returned: points.length,
    speedavg: first.speedavg,
    totaldistance: first.totaldistance,
    points,
  };
}

async function routeWeatherHandler(spec, data, endpoint) {
  if (!data.starttime) {
    data.starttime = formatTime(new Date(Date.now() - 3600 * 1000));
  }
  const payload = await getClient().postForm(endpoint, data);
  const segments = Array.isArray(payload.waypoints) ? payload.waypoints : [];
  const points = [];
  for (const segment of segments) {
    for (const point of segment.waypoints || []) {
      if (Array.isArray(point)) points.push([point[0], point[1]]);
    }
  }
  const sampled = downsample(points, 200);
  return {
    status: payload.status,
    nmile: payload.nmile,
    segments: segments.length,
    passAvoidArea: (payload.passAvoidArea || []).map((area) => area.name),
    returnedPoints: sampled.length,
    points: sampled,
  };
}

async function portListHandler(spec, data, endpoint) {
  const payload = await getClient().get(endpoint, data);
  const ports = (payload.data || []).map((row) =>
    pick(row, [
      "piuid", "port", "cnname", "locode", "unctadPortCode", "lat", "lng",
      "timezone", "type", "portLvl", "hasDetail", "plansCount", "verifiedDate", "seoUrl",
    ]),
  );
  return {
    total: payload.total,
    page: data.page,
    pageSize: data.results,
    count: ports.length,
    ports,
  };
}

async function portStatusHandler(spec, data, endpoint) {
  const client = getClient();
  const portcode = data.portcode;
  if (!portcode) throw new ToolError("INVALID_ARGUMENT", "缺少 portcode");
  const [inPort, arrivals] = await Promise.all([
    client.get(endpoint, { portcode }),
    client.get("/hifleetapi/getarriveshipstypes.do", { portcode }),
  ]);
  return {
    portcode,
    inPort: Array.isArray(inPort) ? inPort[0] : inPort,
    arrivals: Array.isArray(arrivals) ? arrivals.slice(0, 7) : arrivals,
  };
}

async function portWeatherHandler(spec, data, endpoint) {
  const payload = await getClient().get(endpoint, data);
  const body = payload.data || {};
  const current = (body.current_condition || [{}])[0];
  const forecast = (body.weather || []).slice(0, 3).map((day) =>
    pick(day, ["date", "maxtempC", "mintempC", "sunrise", "sunset"]),
  );
  return {
    portname: data.portname,
    current: pick(current, [
      "temp_C", "FeelsLikeC", "weatherDesc", "lang_zh", "windspeedKmph",
      "winddir16Point", "humidity", "visibility", "pressure", "precipMM",
    ]),
    forecast,
  };
}

async function fleetShipsHandler(spec, data, endpoint) {
  const client = getClient();
  const status = await client.status();
  if (!status.loggedIn) {
    throw new HiFleetError(
      "LOGIN_REQUIRED",
      "需要登录：请在插件目录运行 node server/login.mjs",
    );
  }
  const payload = await client.postForm(endpoint, data);
  const rows = payload.data || [];
  const limit = Math.max(1, Math.min(100, Number(data.limit) || 20));
  const ships = rows.slice(0, limit).map((row) =>
    pick(row, ["n", "m", "i", "c", "t", "la", "lo", "sp", "co", "s", "d", "group", "color"]),
  );
  return { count: rows.length, returned: ships.length, ships };
}

async function sessionHandler() {
  await ensureAuth();
  const client = getClient();
  const status = await client.status();
  return {
    loggedIn: status.loggedIn,
    autoLoginError: authError,
    username: client.username,
    hasMtk: Boolean(client.mtk),
    hasUsertoken: Boolean(client.usertoken),
    sessionPath: client.sessionPath,
    sessionExists: fs.existsSync(client.sessionPath),
    loginHint: status.loggedIn
      ? null
      : "在 DSH 设置 → HiFleet 账号 中填写账号密码（推荐），或运行 node server/login.mjs 登录",
    details: status.raw ?? status,
  };
}

async function loginHandler(spec, data, endpoint) {
  const client = getClient();
  if (!data.id) data.id = Math.random();
  const response = await client.postForm(endpoint, data, { check: false });
  if (response && typeof response === "object") {
    if (String(response.status) === "402" || String(response.status) === "S402") {
      throw new HiFleetError("CAPTCHA_REQUIRED", response.msg || "需要验证码", {
        s402: response.s402 || "",
      });
    }
    if (response.mtk) client.mtk = response.mtk;
    if (response.usertoken) client.usertoken = response.usertoken;
  }
  const status = await client.status();
  if (!status.loggedIn) {
    throw new HiFleetError(
      "LOGIN_FAILED",
      `登录失败：${(response && (response.msg || response.message)) || "会话校验未通过"}`,
    );
  }
  client.username = data.email || data.phone || client.username;
  authError = null;
  authPromise = Promise.resolve();
  const sessionPath = client.saveSession(client.username);
  return { loggedIn: true, username: client.username, sessionPath };
}

async function logoutHandler(spec, data, endpoint) {
  const client = getClient();
  let response = null;
  try {
    response = await client.postForm(endpoint, data, { check: false });
  } catch {
    response = null;
  }
  client.mtk = null;
  client.usertoken = null;
  client.username = null;
  try {
    fs.rmSync(client.sessionPath, { force: true });
  } catch {
    // 忽略
  }
  return { loggedIn: false, response };
}

async function urlHandler(spec, data, endpoint) {
  const client = getClient();
  if (spec.token) {
    const token = data.usertoken || client.usertoken;
    if (!token) throw new HiFleetError("SDK_TOKEN_REQUIRED", "缺少 usertoken");
    data.usertoken = token;
  }
  const base = spec.base === "sdk" ? client.sdkUrl : client.baseUrl;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) query.set(key, String(value));
  }
  return { url: `${base}${endpoint}?${query.toString()}` };
}

const HANDLERS = {
  archive: archiveHandler,
  trajectory: trajectoryHandler,
  route_weather: routeWeatherHandler,
  port_list: portListHandler,
  port_status: portStatusHandler,
  port_weather: portWeatherHandler,
  fleet_ships: fleetShipsHandler,
  session: sessionHandler,
  login: loginHandler,
  logout: logoutHandler,
  url: urlHandler,
};

async function dispatch(moduleName, args) {
  if (!args.action) throw new ToolError("INVALID_ARGUMENT", "缺少 action");
  await ensureAuth();
  const { spec, data, endpoint } = prepare(moduleName, args);
  const handler = spec.handler ? HANDLERS[spec.handler] : null;
  if (handler) return handler(spec, data, endpoint);
  return requestSpec(spec, data, endpoint);
}

// ---------------------------------------------------------------- tools
function helpHandler() {
  return {
    plugin: "hifleet-tools",
    mode: "progressive-disclosure",
    instructions: "先读 skills/hifleet/SKILL.md，再按模块读对应的 reference/*.md。",
    modules: Object.entries(REGISTRY).map(([name, info]) => ({
      module: name,
      tool: `hifleet_${name}`,
      description: info.description,
      doc: `skills/hifleet/${info.doc}`,
      actions: Object.keys(info.actions || {}).sort(),
    })),
  };
}

const ALLOWED_PREFIXES = [
  "/particulars/",
  "/hifleetapi/",
  "/portofcall/",
  "/port/",
  "/shipdetail/",
  "/hifleetrouteapi/",
  "/hifleetweatherapi/",
  "/recommendation/",
  "/publicapi/",
  "/service-auth/",
  "/position/",
  "/typhoon/",
  "/oceanweather/",
  "/alertpoint/",
  "/nauticalmap/",
  "/ukhomap/",
  "/hfWeatherApi/",
  "/hfWeatherWaveApi/",
];

function asObject(value, name) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      throw new ToolError("INVALID_ARGUMENT", `${name} 必须是对象或 JSON 字符串`);
    }
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ToolError("INVALID_ARGUMENT", `${name} 必须是对象`);
  }
  return value;
}

async function rawRequestHandler(args) {
  const method = String(args.method || "GET").toUpperCase();
  if (!["GET", "POST"].includes(method)) {
    throw new ToolError("INVALID_ARGUMENT", "method 只支持 GET/POST");
  }

  let rawPath = String(args.url || args.path || "").trim();
  if (!rawPath) {
    throw new ToolError(
      "INVALID_ARGUMENT",
      "需要 path 或 url，例如 /particulars/getShipType 或 https://www.hifleet.com/particulars/getShipType",
    );
  }

  let base = String(args.base || "www");
  let params = asObject(args.params, "params");
  const data = asObject(args.data, "data");
  const json = asObject(args.json, "json");

  if (/^https?:\/\//i.test(rawPath)) {
    const parsed = new URL(rawPath);
    if (parsed.hostname === "api.hifleet.com") base = "sdk";
    else if (parsed.hostname !== "www.hifleet.com") {
      throw new ToolError(
        "INVALID_ARGUMENT",
        `只允许 www.hifleet.com / api.hifleet.com，收到 ${parsed.hostname}`,
      );
    }
    if (parsed.search) {
      params = {
        ...Object.fromEntries(parsed.searchParams.entries()),
        ...(params || {}),
      };
    }
    rawPath = parsed.pathname;
  }

  if (!rawPath.startsWith("/")) rawPath = `/${rawPath}`;
  if (!ALLOWED_PREFIXES.some((prefix) => rawPath.startsWith(prefix))) {
    throw new ToolError(
      "INVALID_ARGUMENT",
      `path 不在允许的前缀内: ${rawPath}`,
    );
  }

  await ensureAuth();
  const client = getClient();
  if (base === "sdk") {
    params = { ...(params || {}) };
    const token = params.usertoken || client.usertoken;
    if (!token) throw new HiFleetError("SDK_TOKEN_REQUIRED", "缺少 usertoken");
    params.usertoken = token;
  }

  return client.request(method, rawPath, {
    params,
    form: data,
    json,
    baseUrl: base === "sdk" ? client.sdkUrl : undefined,
    referer:
      base === "sdk"
        ? `${client.baseUrl}/web/?i18n=${client.language}`
        : undefined,
    check: args.check !== false,
  });
}

export const TOOLS = [
  {
    name: "hifleet_help",
    description:
      "返回 HiFleet 全功能模块索引、每个模块的 action 和对应 MD 文档路径。先调用它，再按需读取 MD。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: helpHandler,
  },
  {
    name: "hifleet_request",
    description:
      "通用接口请求（兜底）。可调用文档中任何 www.hifleet.com 或 api.hifleet.com 接口。参数见 reference/01-common.md。",
    inputSchema: {
      type: "object",
      properties: {
        method: {
          type: "string",
          enum: ["GET", "POST"],
          description: "HTTP 方法",
        },
        path: {
          type: "string",
          description: "接口路径，如 /particulars/getShipType；不带前导 / 也兼容",
        },
        url: {
          type: "string",
          description: "完整 URL，与 path 二选一；支持 www.hifleet.com 和 api.hifleet.com",
        },
        base: {
          type: "string",
          enum: ["www", "sdk"],
          default: "www",
          description: "www 或 sdk",
        },
        params: {
          type: "object",
          additionalProperties: true,
          description: "查询参数对象，也接受 JSON 字符串",
        },
        data: {
          type: "object",
          additionalProperties: true,
          description: "表单参数对象，也接受 JSON 字符串",
        },
        json: {
          type: "object",
          additionalProperties: true,
          description: "JSON body 对象，也接受 JSON 字符串",
        },
        check: {
          type: "boolean",
          description: "是否做登录/验证码/业务错误检查",
        },
      },
      required: ["method"],
      additionalProperties: false,
    },
    handler: rawRequestHandler,
  },
  {
    name: "hifleet_session",
    description: "查看本地会话状态、登录用户、mtk/usertoken 和会话文件路径。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: sessionHandler,
  },
];

for (const [moduleName, info] of Object.entries(REGISTRY)) {
  TOOLS.push({
    name: `hifleet_${moduleName}`,
    description: `${info.description}。action 列表和参数见 skills/hifleet/${info.doc}。`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: Object.keys(info.actions || {}).sort(),
        },
        params: {
          type: "object",
          additionalProperties: true,
          description: "action 对应参数，详见模块 MD",
        },
        confirm: {
          type: "boolean",
          description: "写操作必须传 true",
        },
      },
      required: ["action"],
      additionalProperties: false,
    },
    handler: (args) => dispatch(moduleName, args),
  });
}
