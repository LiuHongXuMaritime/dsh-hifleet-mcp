/**
 * HiFleet MCP Server（stdio，零依赖）。
 *
 * 协议：JSON-RPC 2.0，按行分隔。只实现本地工具所需的最小方法集。
 */

import readline from "node:readline";

import { TOOLS } from "./tools.mjs";

const SERVER_INFO = { name: "hifleet-tools", version: "2.1.1" };
const SUPPORTED_PROTOCOLS = ["2024-11-05", "2025-03-26", "2025-06-18"];

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function runSafe(handler, args) {
  try {
    return { ok: true, data: await handler(args || {}) };
  } catch (error) {
    const payload = {
      ok: false,
      error: error.code || "ERROR",
      message: error.message || String(error),
    };
    if (error.s402) payload.s402 = error.s402;
    return payload;
  }
}

async function handleMessage(message) {
  const { id, method, params } = message;
  const isNotification = id === undefined || id === null;

  if (method === "initialize") {
    const requested = params?.protocolVersion;
    const protocolVersion = SUPPORTED_PROTOCOLS.includes(requested)
      ? requested
      : "2024-11-05";
    reply(id, {
      protocolVersion,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
    return;
  }

  if (method === "notifications/initialized" || method === "initialized") {
    return;
  }

  if (method === "ping" || method === "logging/setLevel") {
    if (!isNotification) reply(id, {});
    return;
  }

  if (method === "tools/list") {
    reply(id, {
      tools: TOOLS.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      })),
    });
    return;
  }

  if (method === "tools/call") {
    const name = params?.name;
    const tool = TOOLS.find((item) => item.name === name);
    if (!tool) {
      replyError(id, -32602, `未知工具: ${name}`);
      return;
    }
    const result = await runSafe(tool.handler, params?.arguments || {});
    reply(id, {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError: result.ok === false,
    });
    return;
  }

  if (method === "resources/list") {
    reply(id, { resources: [] });
    return;
  }

  if (method === "prompts/list") {
    reply(id, { prompts: [] });
    return;
  }

  if (!isNotification) {
    replyError(id, -32601, `Method not found: ${method}`);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

let queue = Promise.resolve();

rl.on("line", (line) => {
  const text = line.trim();
  if (!text) return;
  queue = queue
    .then(async () => {
      let message;
      try {
        message = JSON.parse(text);
      } catch {
        return;
      }
      await handleMessage(message);
    })
    .catch((error) => {
      process.stderr.write(`[hifleet-mcp] ${error?.stack || error}\n`);
    });
});

rl.on("close", () => {
  process.exit(0);
});

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
process.stderr.write("[hifleet-mcp] server started (stdio)\n");
