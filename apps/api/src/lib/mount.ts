import type { RequestHandler, Router } from "express";

// Pasang router di path sambil mencatat path-nya pada handler. Express 5 tidak menyimpan teks path mount (hanya
// fungsi pencocok), padahal test inventaris rute (ARCHITECTURE §9.5) butuh path lengkap tiap rute.
export const MOUNT_PATH_TAG = Symbol.for("platform.mountPath");

// `Express` juga memenuhi `Router` untuk `use(path, …handlers)`.
export function mountAt(target: Router, path: string, ...handlers: (RequestHandler | Router)[]): void {
  for (const handler of handlers) Object.assign(handler, { [MOUNT_PATH_TAG]: path });
  target.use(path, ...handlers);
}
