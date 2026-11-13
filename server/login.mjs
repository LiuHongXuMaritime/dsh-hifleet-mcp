/**
 * 本地登录工具（不是 MCP tool）。
 *
 * 用法：
 *   node server/login.mjs
 *   node server/login.mjs your@email.com
 *
 * 登录成功后把 Cookie / mtk 写入 ~/.hifleet/session.json，
 * MCP 工具会自动读取该文件。
 */

import readline from "node:readline";
import process from "node:process";

import { HiFleetClient } from "./client.mjs";
import { loadEnv } from "./env.mjs";

loadEnv();

function ask(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askHidden(query) {
  return new Promise((resolve) => {
    process.stdout.write(query);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";
    const cleanup = () => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    const onData = (chunk) => {
      if (chunk === "\r" || chunk === "\n") {
        cleanup();
        process.stdout.write("\n");
        resolve(value);
      } else if (chunk === "\u0003") {
        cleanup();
        process.stdout.write("\n");
        process.exit(130);
      } else if (chunk === "\u007f" || chunk === "\b") {
        value = value.slice(0, -1);
      } else {
        value += chunk;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const email =
    process.argv[2] || process.env.HIFLEET_USERNAME || (await ask("HiFleet 账号: "));
  const password =
    process.argv[3] ||
    process.env.HIFLEET_PASSWORD ||
    (await askHidden("HiFleet 密码: "));

  if (!email || !password) {
    console.error("账号和密码不能为空");
    process.exit(2);
  }

  const client = new HiFleetClient();
  client.loadSession();

  try {
    await client.login(email, password);
    const file = client.saveSession(email);
    console.log(`登录成功，会话已保存: ${file}`);
    process.exit(0);
  } catch (error) {
    console.error(`[${error.code || "ERROR"}] ${error.message || error}`);
    if (error.s402) {
      console.error(`需要人机校验，authItemCode=${error.s402}`);
      console.error("请先在浏览器完成验证码，或改用浏览器 Cookie 写入会话文件。");
    }
    process.exit(1);
  }
}

main();
