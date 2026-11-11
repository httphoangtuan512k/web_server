#!/usr/bin/env node
/**
 * Chạy API (NestJS) + Web (Next.js) cùng lúc bằng 1 lệnh:  npm run dev
 *   API : http://localhost:4000
 *   Web : http://localhost:3000   (mở cái này; /api/* tự chuyển sang API)
 * Ctrl+C dừng cả hai.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API_PORT = process.env.API_PORT || "4000";
const WEB_PORT = process.env.WEB_PORT || "3000";

for (const app of ["api", "web"]) {
  if (!existsSync(join(root, "apps", app, "node_modules"))) {
    console.error(`\x1b[31m✖ Chưa cài thư viện cho apps/${app}. Chạy trước: npm run setup\x1b[0m`);
    process.exit(1);
  }
}

const procs = [
  { name: "api", color: "\x1b[36m", cwd: "apps/api", args: ["run", "dev"], env: { PORT: API_PORT } },
  { name: "web", color: "\x1b[35m", cwd: "apps/web", args: ["run", "dev", "--", "-p", WEB_PORT], env: { API_URL: `http://localhost:${API_PORT}` } },
];

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = procs.map((p) => {
  const child = spawn(npm, p.args, {
    cwd: join(root, p.cwd),
    env: { ...process.env, ...p.env, FORCE_COLOR: "1" },
    shell: process.platform === "win32",
  });
  const prefix = `${p.color}[${p.name}]\x1b[0m `;
  const pipe = (stream, out) => {
    let buf = "";
    stream.on("data", (chunk) => {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) out.write(prefix + line + "\n");
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => {
    console.log(`${prefix}đã dừng (mã ${code ?? 0})`);
    shutdown(code ?? 0);
  });
  return child;
});

console.log(`\n  SUPER WHITE dev → mở \x1b[1mhttp://localhost:${WEB_PORT}\x1b[0m  (API: http://localhost:${API_PORT})\n`);

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill("SIGINT");
  setTimeout(() => process.exit(code), 1500).unref();
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
