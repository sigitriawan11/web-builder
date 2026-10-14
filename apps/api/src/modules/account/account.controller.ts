import { isIP } from "node:net";
import { AppError } from "@platform/shared";
import type { Request, Response } from "express";
import type { ValidatedHandler } from "../../middleware/validate";
import type { acceptConsentsRequest, getConsentsRequest } from "./account.schema";
import type { AccountService } from "./account.service";

// Controller: request tervalidasi → service → envelope response (ARCHITECTURE §5.3). Tanpa logika bisnis.

const meta = (res: Response) => ({ requestId: String(res.getHeader("x-request-id") ?? "") });

/** User login (router sudah memasang requireAuth). */
function userId(req: Request): string {
  if (!req.ctx.user) throw new AppError("UNAUTHENTICATED");
  return req.ctx.user.id;
}

export function createAccountController(service: AccountService) {
  const getConsents: ValidatedHandler<typeof getConsentsRequest> = async (req, res) => {
    res.json({ data: await service.consentStatus(userId(req)), meta: meta(res) });
  };
  const acceptConsents: ValidatedHandler<typeof acceptConsentsRequest> = async (req, res) => {
    const userAgent = req.get("user-agent");
    const evidence = { ...(req.ip && isIP(req.ip) ? { ip: req.ip } : {}), ...(userAgent ? { userAgent } : {}) };
    res.json({ data: await service.acceptConsents(userId(req), req.valid.body, evidence), meta: meta(res) });
  };
  return { getConsents, acceptConsents };
}
