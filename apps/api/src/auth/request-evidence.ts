import { AsyncLocalStorage } from "node:async_hooks";
import { isIP } from "node:net";
import type { RequestHandler } from "express";

// IP & user agent request auth (dari Express, menghormati `trust proxy`) untuk hook Better Auth yang mencatat
// audit — BA sendiri hanya melihat header mentah.

export interface RequestEvidence {
  ip?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestEvidence>();

export function currentEvidence(): RequestEvidence {
  return storage.getStore() ?? {};
}

export function requestEvidence(): RequestHandler {
  return (req, _res, next) => {
    const userAgent = req.get("user-agent");
    storage.run({ ...(req.ip && isIP(req.ip) ? { ip: req.ip } : {}), ...(userAgent ? { userAgent } : {}) }, () =>
      next(),
    );
  };
}
