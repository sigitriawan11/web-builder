import { isIP } from "node:net";
import { AppError } from "@platform/shared";
import type { Request, Response } from "express";
import type { ValidatedHandler } from "../../middleware/validate";
import type {
  acceptConsentsRequest,
  getConsentsRequest,
  listSessionsRequest,
  revokeOtherSessionsRequest,
  revokeSessionRequest,
} from "./account.schema";
import type { AccountService, Actor } from "./account.service";

// Controller: request tervalidasi → service → envelope response (ARCHITECTURE §5.3). Tanpa logika bisnis.

const meta = (res: Response) => ({ requestId: String(res.getHeader("x-request-id") ?? "") });

/** User login (router sudah memasang requireAuth). */
function userId(req: Request): string {
  if (!req.ctx.user) throw new AppError("UNAUTHENTICATED");
  return req.ctx.user.id;
}

function actor(req: Request): Actor {
  if (!req.ctx.user || !req.ctx.session) throw new AppError("UNAUTHENTICATED");
  return { userId: req.ctx.user.id, sessionId: req.ctx.session.id };
}

function evidence(req: Request) {
  const userAgent = req.get("user-agent");
  return { ...(req.ip && isIP(req.ip) ? { ip: req.ip } : {}), ...(userAgent ? { userAgent } : {}) };
}

export function createAccountController(service: AccountService) {
  const getConsents: ValidatedHandler<typeof getConsentsRequest> = async (req, res) => {
    res.json({ data: await service.consentStatus(userId(req)), meta: meta(res) });
  };
  const acceptConsents: ValidatedHandler<typeof acceptConsentsRequest> = async (req, res) => {
    res.json({ data: await service.acceptConsents(userId(req), req.valid.body, evidence(req)), meta: meta(res) });
  };
  const listSessions: ValidatedHandler<typeof listSessionsRequest> = async (req, res) => {
    res.json({ data: await service.listSessions(actor(req)), meta: meta(res) });
  };
  const revokeSession: ValidatedHandler<typeof revokeSessionRequest> = async (req, res) => {
    await service.revokeSession(actor(req), req.valid.params.sessionId, evidence(req));
    res.status(204).end();
  };
  const revokeOtherSessions: ValidatedHandler<typeof revokeOtherSessionsRequest> = async (req, res) => {
    res.json({ data: await service.revokeOtherSessions(actor(req), evidence(req)), meta: meta(res) });
  };
  return { getConsents, acceptConsents, listSessions, revokeSession, revokeOtherSessions };
}
