import { request as httpRequest } from "node:http";

// Helper `*.localhost` untuk kode Node di e2e (global setup, helper data): Chromium me-resolve `*.localhost` sendiri,
// tetapi resolver Node/WSL belum tentu (ARCHITECTURE §15) → sambung ke 127.0.0.1 dengan header Host asli.
// `fetch` (undici) tidak mengizinkan header Host, jadi memakai node:http.

export interface LocalResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  json<T = unknown>(): T;
}

export function isLocalhostHost(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost");
}

export function localhostRequest(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<LocalResponse> {
  const target = new URL(url);
  if (!isLocalhostHost(target.hostname)) throw new Error(`localhostRequest hanya untuk *.localhost: ${url}`);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port: target.port || 80,
        path: `${target.pathname}${target.search}`,
        method: init.method ?? "GET",
        headers: { ...init.headers, host: target.host },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body, json: () => JSON.parse(body) });
        });
      },
    );
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}
