/**
 * DSH host half for the HiFleet Tools bundle.
 *
 * The browser half (client.js) renders the account page in Settings and on the
 * plugin page; this half serves its read / save / clear endpoints and keeps the
 * credentials in a file the MCP server process can read. The page is served by
 * the same web carrier, so these routes are same-origin and need no CORS.
 *
 * Security: both routes are loopback-only (the DSH UI talks to the local web
 * carrier) and the credential file is created with owner-only permissions.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const name = "hifleet-account";

const ROUTE_BASE = "/dsh-hifleet/api";
const MAX_BODY_BYTES = 64 * 1024;

function credentialsPath() {
  const override = process.env.HIFLEET_CREDENTIALS;
  if (typeof override === "string" && override.trim() !== "") {
    return path.resolve(override.trim());
  }
  return path.join(os.homedir(), ".hifleet", "credentials.json");
}

function sessionPath() {
  const override = process.env.HIFLEET_SESSION;
  if (typeof override === "string" && override.trim() !== "") {
    return path.resolve(override.trim());
  }
  return path.join(os.homedir(), ".hifleet", "session.json");
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function readSavedCredentials() {
  const raw = readJson(credentialsPath());
  if (raw === null || typeof raw !== "object") return null;
  const username = typeof raw.username === "string" ? raw.username.trim() : "";
  const password = typeof raw.password === "string" ? raw.password : "";
  if (username === "" || password === "") return null;
  return {
    username,
    password,
    savedAt: typeof raw.savedAt === "string" ? raw.savedAt : null,
  };
}

function writeSavedCredentials(username, password) {
  const file = credentialsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const body =
    JSON.stringify(
      { username, password, savedAt: new Date().toISOString() },
      null,
      2,
    ) + "\n";
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, body, { mode: 0o600 });
  fs.renameSync(temporary, file);
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* Windows: the ACL is inherited; nothing to tighten here */
  }
}

function statusPayload() {
  const saved = readSavedCredentials();
  const session = readJson(sessionPath());
  const sessionUsername =
    session !== null &&
    typeof session === "object" &&
    typeof session.username === "string"
      ? session.username
      : null;
  return {
    ok: true,
    credentials: {
      configured: saved !== null,
      username: saved === null ? null : saved.username,
      savedAt: saved === null ? null : saved.savedAt,
      path: credentialsPath(),
    },
    session: {
      exists: session !== null,
      username: sessionUsername,
      path: sessionPath(),
    },
  };
}

function sendJson(response, statusCode, payload) {
  const text = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(text),
  });
  response.end(text);
}

function isLoopbackRequest(request) {
  const socket = request.socket;
  const address = socket === null || socket === undefined ? "" : socket.remoteAddress || "";
  if (address === "") return false;
  return (
    address.startsWith("127.") ||
    address === "::1" ||
    address.startsWith("::ffff:127.")
  );
}

function headerValue(request, name) {
  const headers = request.headers;
  if (headers === null || headers === undefined) return "";
  const value = headers[name];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(",");
  return "";
}

// CSRF 防护：写请求必须来自同源页面（JSON Content-Type + 自定义头）。
// 跨站页面无法在不触发 CORS 预检的情况下同时伪造这两者。
function hasWriteGuard(request) {
  const contentType = headerValue(request, "content-type").toLowerCase();
  return (
    contentType.includes("application/json") &&
    headerValue(request, "x-dsh-hifleet") === "1"
  );
}

function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("request body too large"), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function refuse(response, statusCode, error, message) {
  sendJson(response, statusCode, {
    ok: false,
    error,
    ...(message === undefined ? {} : { message }),
  });
}

export function apply(ctx) {
  ctx.inject(["webServer"], (host) => {
    host.effect(() => {
      const disposers = [];

      disposers.push(
        host.webServer.register({
          kind: "exact",
          path: `${ROUTE_BASE}/status`,
          handler: (request, response) => {
            if (!isLoopbackRequest(request)) {
              refuse(response, 403, "loopback_only");
              return;
            }
            if (request.method !== "GET") {
              response.writeHead(405, { allow: "GET" });
              response.end();
              return;
            }
            sendJson(response, 200, statusPayload());
          },
        }),
      );

      disposers.push(
        host.webServer.register({
          kind: "exact",
          path: `${ROUTE_BASE}/credentials`,
          handler: async (request, response) => {
            if (!isLoopbackRequest(request)) {
              refuse(response, 403, "loopback_only");
              return;
            }
            if (headerValue(request, "x-dsh-hifleet") !== "1") {
              refuse(response, 403, "csrf_guard", "missing x-dsh-hifleet header");
              return;
            }
            if (request.method === "DELETE") {
              try {
                fs.rmSync(credentialsPath(), { force: true });
              } catch (error) {
                refuse(response, 500, "clear_failed", String(error));
                return;
              }
              sendJson(response, 200, statusPayload());
              return;
            }
            if (request.method !== "POST") {
              response.writeHead(405, { allow: "POST, DELETE" });
              response.end();
              return;
            }
            if (!hasWriteGuard(request)) {
              refuse(
                response,
                403,
                "csrf_guard",
                "content-type must be application/json and x-dsh-hifleet must be 1",
              );
              return;
            }
            let body;
            try {
              body = JSON.parse(await readBody(request, MAX_BODY_BYTES));
            } catch (error) {
              refuse(response, 400, "invalid_body", String(error && error.message ? error.message : error));
              return;
            }
            const username =
              body !== null && typeof body === "object" && typeof body.username === "string"
                ? body.username.trim()
                : "";
            const password =
              body !== null && typeof body === "object" && typeof body.password === "string"
                ? body.password
                : "";
            if (username === "" || password === "") {
              refuse(response, 400, "missing_credentials", "username and password are required");
              return;
            }
            try {
              writeSavedCredentials(username, password);
            } catch (error) {
              refuse(response, 500, "write_failed", String(error));
              return;
            }
            // 保存后一律丢掉旧会话：下一次工具调用会用新账号重新登录，
            // 也覆盖“同一账号改了密码”的情况。
            try {
              fs.rmSync(sessionPath(), { force: true });
            } catch {
              /* the MCP server re-reads the session anyway */
            }
            sendJson(response, 200, statusPayload());
          },
        }),
      );

      return () => {
        for (const dispose of disposers) {
          try {
            dispose();
          } catch {
            /* already disposed */
          }
        }
      };
    }, "hifleet: account settings routes");
  });
}
