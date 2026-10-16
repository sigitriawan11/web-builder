// Launcher stack e2e (keputusan owner T1.14.4): satu `webServer` Playwright yang, BERURUTAN,
// 1) membuat ulang database `platform_e2e` dari migration, 2) mengosongkan Redis DB e2e (rate limit, cache sesi,
// antrean), 3) menjalankan worker (queue email) lalu menunggu siap, 4) menjalankan api. Playwright menunggu
// `/health/ready` api. Env (port, DB, Redis) disiapkan playwright.config.ts; tidak menyentuh DB/dev server owner.
import { spawn } from "node:child_process";
import { connect } from "node:net";

const env = process.env;
const children = [];

function run(command, args, extraEnv = {}) {
  const child = spawn(command, args, { env: { ...env, ...extraEnv }, stdio: "inherit" });
  children.push(child);
  return child;
}

function runToEnd(command, args) {
  return new Promise((resolve, reject) => {
    run(command, args).on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${args.join(" ")} → ${code}`)),
    );
  });
}

/** FLUSHDB pada DB Redis e2e lewat protokol RESP mentah (tanpa dependency klien). */
function flushRedis(url) {
  const { hostname, port, pathname } = new URL(url);
  const db = pathname.replace("/", "") || "0";
  if (db === "0") throw new Error("Redis e2e harus memakai DB terpisah (mis. redis://localhost:6379/5), bukan DB 0");
  return new Promise((resolve, reject) => {
    const socket = connect(Number(port || 6379), hostname, () => socket.write(`SELECT ${db}\r\nFLUSHDB\r\n`));
    let reply = "";
    socket.on("data", (chunk) => {
      reply += chunk;
      if ((reply.match(/\+OK\r\n/g) ?? []).length >= 2) {
        socket.end();
        resolve();
      } else if (reply.startsWith("-")) reject(new Error(`Redis: ${reply.trim()}`));
    });
    socket.on("error", reject);
  });
}

async function waitFor(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // belum siap
    }
    if (Date.now() > deadline) throw new Error(`tidak siap: ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

function shutdown(code) {
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
  process.exit(code);
}
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => shutdown(0));

try {
  await runToEnd("pnpm", ["--filter", "@platform/db", "db:prepare-e2e"]);
  await flushRedis(env.REDIS_URL);
  run("pnpm", ["--filter", "@platform/worker", "start"], { ...JSON.parse(env.E2E_WORKER_ENV ?? "{}") });
  await waitFor(`http://127.0.0.1:${JSON.parse(env.E2E_WORKER_ENV ?? "{}").WORKER_HEALTH_PORT}/health/ready`);
  const api = run("pnpm", ["--filter", "@platform/api", "start"], { ...JSON.parse(env.E2E_API_ENV ?? "{}") });
  api.on("exit", (code) => shutdown(code ?? 1));
} catch (error) {
  console.error(error);
  shutdown(1);
}
