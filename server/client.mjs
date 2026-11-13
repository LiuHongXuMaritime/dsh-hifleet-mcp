/**
 * HiFleet HTTP 客户端（零依赖，使用 Node 内置 fetch）。
 * 负责 Cookie、mtk、本地会话、错误归一化。
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE_URL = "https://www.hifleet.com";
const SDK_URL = "https://api.hifleet.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36";

export const DEFAULT_SESSION_PATH =
  process.env.HIFLEET_SESSION || path.join(os.homedir(), ".hifleet", "session.json");

export class HiFleetError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = "HiFleetError";
    this.code = code;
    Object.assign(this, extra);
  }
}

export class HiFleetClient {
  constructor(options = {}) {
    this.baseUrl = BASE_URL;
    this.sdkUrl = SDK_URL;
    this.language = options.language || "zh";
    this.timeout = options.timeout || 30000;
    this.sessionPath = options.sessionPath || DEFAULT_SESSION_PATH;
    this.cookies = new Map();
    this.mtk = null;
    this.usertoken = null;
    this.username = null;
    this.bootstrapped = false;
    this._bootstrapPromise = null;
  }

  // ---------------------------------------------------------------- 会话
  loadSession() {
    try {
      if (!fs.existsSync(this.sessionPath)) return false;
      const raw = JSON.parse(fs.readFileSync(this.sessionPath, "utf8"));
      if (!raw || typeof raw !== "object") return false;
      this.cookies = new Map(Object.entries(raw.cookies || {}));
      this.mtk = raw.mtk || null;
      this.usertoken = raw.usertoken || null;
      this.username = raw.username || null;
      return true;
    } catch {
      return false;
    }
  }

  resetAuth() {
    // DSH 设置项补丁：清空进程内登录态，让下一次 status() 重新判断，
    // 从而可以用设置页保存的新账号/新密码重新登录。
    this.cookies = new Map();
    this.mtk = null;
    this.usertoken = null;
    this.username = null;
    this.bootstrapped = false;
    this._bootstrapPromise = null;
  }

  saveSession(username) {
    const target = this.sessionPath;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const data = {
      cookies: Object.fromEntries(this.cookies),
      mtk: this.mtk,
      usertoken: this.usertoken,
      username: username || this.username || null,
      saved_at: Math.floor(Date.now() / 1000),
    };
    fs.writeFileSync(target, JSON.stringify(data, null, 2), "utf8");
    try {
      fs.chmodSync(target, 0o600);
    } catch {
      // Windows 下可能不支持，忽略
    }
    return target;
  }

  cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  captureCookies(response) {
    const lines =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];
    for (const line of lines) {
      const pair = String(line).split(";")[0];
      const index = pair.indexOf("=");
      if (index > 0) {
        this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
      }
    }
  }

  baseHeaders(referer) {
    const headers = {
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      Origin: this.baseUrl,
      Referer: referer || `${this.baseUrl}/vessels/?i18n=${this.language}`,
    };
    if (this.cookies.size > 0) headers.Cookie = this.cookieHeader();
    return headers;
  }

  async bootstrap() {
    if (this.bootstrapped) return;
    if (!this._bootstrapPromise) {
      this._bootstrapPromise = (async () => {
        let response;
        try {
          response = await fetch(`${this.baseUrl}/vessels/?i18n=${this.language}`, {
            headers: this.baseHeaders(),
            signal: AbortSignal.timeout(this.timeout),
          });
        } catch (error) {
          throw new HiFleetError("NETWORK_ERROR", `初始化会话失败: ${error.message}`);
        }
        this.captureCookies(response);
        this.cookies.set("Browserlang", this.language);
        this.bootstrapped = true;
        this._bootstrapPromise = null;
      })();
    }
    return this._bootstrapPromise;
  }

  // ---------------------------------------------------------------- 请求
  async request(method, requestPath, options = {}) {
    await this.bootstrap();

    const requestBase = options.baseUrl || this.baseUrl;
    let url = requestPath.startsWith("http")
      ? requestPath
      : `${requestBase}${requestPath}`;

    if (
      this.mtk &&
      url.includes("/hifleetapi/") &&
      !url.includes("mtk=") &&
      !url.includes("api.hifleet.com")
    ) {
      const parsed = new URL(url);
      parsed.searchParams.set("mtk", this.mtk);
      url = parsed.toString();
    }

    if (options.params) {
      const parsed = new URL(url);
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          parsed.searchParams.set(key, String(value));
        }
      }
      url = parsed.toString();
    }

    const headers = this.baseHeaders(options.referer);
    let body;
    if (options.form) {
      headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
      body = new URLSearchParams(options.form).toString();
    } else if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    }

    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(this.timeout),
      });
    } catch (error) {
      throw new HiFleetError("NETWORK_ERROR", `请求失败: ${error.message}`);
    }

    this.captureCookies(response);

    if (response.status === 401 && !options.allow401) {
      throw new HiFleetError("LOGIN_REQUIRED", "HTTP 401，需要登录");
    }
    if (response.status >= 400) {
      throw new HiFleetError("HTTP_ERROR", `HTTP ${response.status}`);
    }

    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }

    if (options.check !== false) this.checkPayload(payload);
    return payload;
  }

  checkPayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;

    const status = String(payload.status ?? "");
    const message = String(payload.msg ?? payload.message ?? "");

    if (status === "402" || status === "S402") {
      throw new HiFleetError("CAPTCHA_REQUIRED", message || "需要人机校验", {
        s402: payload.s402 || "",
      });
    }

    if (
      payload.error === "NOT_LOGIN" ||
      message.includes("NOT LOGIN") ||
      message === "未登录" ||
      message === "登录信息已失效，请重新登录"
    ) {
      throw new HiFleetError("LOGIN_REQUIRED", message || "需要登录", { payload });
    }

    const code = payload.code;
    if (code === 4005 || (code === 500 && message.toLowerCase().includes("token"))) {
      throw new HiFleetError("SDK_TOKEN_REQUIRED", message || "缺少 usertoken");
    }

    if (status === "0" && (payload.data === null || payload.data === "") && message) {
      throw new HiFleetError("API_ERROR", message, { payload });
    }
  }

  get(requestPath, params, options = {}) {
    return this.request("GET", requestPath, { ...options, params });
  }

  postForm(requestPath, form, options = {}) {
    return this.request("POST", requestPath, { ...options, form });
  }

  postJson(requestPath, json, options = {}) {
    return this.request("POST", requestPath, { ...options, json });
  }

  async status() {
    try {
      const data = await this.get(
        "/hifleetapi/loginstatus.do",
        { id: Date.now() },
        { check: false },
      );
      return {
        loggedIn: String(data?.login) === "1",
        raw: data,
      };
    } catch (error) {
      return { loggedIn: false, error: error.code || "ERROR", message: error.message };
    }
  }

  async login(email, password) {
    const response = await this.postForm(
      "/hifleetapi/generalUserLoginAction.do",
      { id: Math.random(), email, password },
      { check: false },
    );

    if (response && typeof response === "object") {
      const status = String(response.status ?? "");
      if (status === "402" || status === "S402") {
        throw new HiFleetError("CAPTCHA_REQUIRED", response.msg || "需要验证码", {
          s402: response.s402 || "",
        });
      }
      if (response.mtk) this.mtk = response.mtk;
      if (response.usertoken) this.usertoken = response.usertoken;
    }

    const status = await this.status();
    if (!status.loggedIn) {
      const message =
        (response && (response.msg || response.message)) || "会话校验未通过";
      throw new HiFleetError(
        "LOGIN_FAILED",
        `登录失败：${message}（如站点要求验证码/CAS，请改用 Cookie 注入）`,
      );
    }

    this.username = email;
    return response;
  }
}
