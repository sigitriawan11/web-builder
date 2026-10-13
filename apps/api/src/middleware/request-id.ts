import { uuidv7 } from "@platform/shared";
import { runWithContext } from "@platform/shared/node";
import type { RequestHandler } from "express";

// Middleware 1 (ARCHITECTURE §5.3, §13): requestId dari edge pertama (Next.js / site-host) bila formatnya aman,
// selain itu UUIDv7 baru. Dikembalikan di header response dan dibawa AsyncLocalStorage ke seluruh request.
export const REQUEST_ID_HEADER = "x-request-id";

// Hanya karakter aman untuk log/header; panjang dibatasi agar tidak bisa dipakai menyuntik log.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

export function requestId(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.get(REQUEST_ID_HEADER);
    const id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : uuidv7();
    req.ctx = { requestId: id };
    res.setHeader(REQUEST_ID_HEADER, id);
    runWithContext({ requestId: id }, () => next());
  };
}
