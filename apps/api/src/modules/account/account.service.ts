import type { Db } from "@platform/db";
import { AppError, LEGAL_VERSIONS } from "@platform/shared";
import type {
  AcceptConsentsBody,
  ConsentStatus,
  Profile,
  SessionInfo,
  UpdateProfileBody,
} from "@platform/shared/contracts";
import { recordAudit } from "../../audit/audit.repository";
import * as repository from "./account.repository";

// Persetujuan legal (ACC-002 layar S&K pertama kali untuk user Google, ACC-313 penerimaan ulang versi baru).

export interface ConsentEvidence {
  ip?: string;
  userAgent?: string;
}

function legalStatus(rows: repository.ConsentRow[], type: "terms" | "privacy") {
  const latest = rows.find((row) => row.type === type);
  const currentVersion = LEGAL_VERSIONS[type];
  return {
    accepted: latest?.granted === true && latest.version === currentVersion,
    currentVersion,
    acceptedVersion: latest?.granted ? latest.version : null,
  };
}

/** Pengguna & sesi request ini (dari authSession). */
export interface Actor {
  userId: string;
  sessionId: string;
}

export interface AccountServiceDeps {
  db: Db;
  // Port pencabutan sesi (implementasi: Better Auth `deleteSessions` → hapus DB + cache Redis seketika).
  revokeSessionTokens: (tokens: string[]) => Promise<void>;
  // Port ubah field user (implementasi: Better Auth `updateUser` → DB + salinan user di cache sesi Redis, agar
  // `req.ctx.user` tidak basi).
  updateUser: (userId: string, fields: Partial<Pick<Profile, "name" | "locale" | "timezone">>) => Promise<void>;
}

function toSessionInfo(row: repository.SessionRow, currentSessionId: string): SessionInfo {
  return {
    id: row.id,
    current: row.id === currentSessionId,
    userAgent: row.userAgent,
    ip: row.ipAddress,
    geo: row.geo ?? null,
    createdAt: row.createdAt.toISOString(),
    lastActiveAt: row.lastActiveAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export function createAccountService(deps: AccountServiceDeps) {
  const { db } = deps;
  async function consentStatus(userId: string): Promise<ConsentStatus> {
    const rows = await repository.listUserConsents(db, userId);
    return {
      terms: legalStatus(rows, "terms"),
      privacy: legalStatus(rows, "privacy"),
      marketing: { granted: rows.find((row) => row.type === "marketing")?.granted === true },
    };
  }

  async function acceptConsents(
    userId: string,
    body: AcceptConsentsBody,
    evidence: ConsentEvidence,
  ): Promise<ConsentStatus> {
    const base = { userId, ip: evidence.ip ?? null, userAgent: evidence.userAgent ?? null };
    await repository.insertUserConsents(db, [
      { ...base, type: "terms", version: LEGAL_VERSIONS.terms, granted: true },
      { ...base, type: "privacy", version: LEGAL_VERSIONS.privacy, granted: true },
      ...(body.marketingOptIn === undefined
        ? []
        : [{ ...base, type: "marketing" as const, version: LEGAL_VERSIONS.marketing, granted: body.marketingOptIn }]),
    ]);
    return consentStatus(userId);
  }

  // --- Sesi & perangkat (ACC-007) ---

  async function listSessions(actor: Actor): Promise<SessionInfo[]> {
    const rows = await repository.listActiveSessions(db, actor.userId);
    return rows.map((row) => toSessionInfo(row, actor.sessionId));
  }

  async function auditRevoke(actor: Actor, evidence: ConsentEvidence, metadata: Record<string, unknown>) {
    await recordAudit(db, {
      actorType: "user",
      actorId: actor.userId,
      action: "auth.session_revoke",
      targetType: "user",
      targetId: actor.userId,
      ip: evidence.ip ?? null,
      userAgent: evidence.userAgent ?? null,
      metadata,
    });
  }

  /** Cabut satu sesi milik user. Sesi saat ini tidak bisa (pakai logout); sesi user lain = tidak ditemukan. */
  async function revokeSession(actor: Actor, sessionId: string, evidence: ConsentEvidence): Promise<void> {
    if (sessionId === actor.sessionId) throw new AppError("CONFLICT", undefined, { reason: "current_session" });
    const session = await repository.findActiveSession(db, actor.userId, sessionId);
    if (!session) throw new AppError("NOT_FOUND");
    await deps.revokeSessionTokens([session.token]);
    await auditRevoke(actor, evidence, { sessionId });
  }

  /** "Keluar dari semua perangkat lain". */
  async function revokeOtherSessions(actor: Actor, evidence: ConsentEvidence): Promise<{ revoked: number }> {
    const tokens = await repository.otherSessionTokens(db, actor.userId, actor.sessionId);
    if (tokens.length > 0) await deps.revokeSessionTokens(tokens);
    await auditRevoke(actor, evidence, { others: true, revoked: tokens.length });
    return { revoked: tokens.length };
  }

  // --- Profil (ACC-008) ---

  async function getProfile(userId: string): Promise<Profile> {
    const profile = await repository.findProfile(db, userId);
    if (!profile) throw new AppError("NOT_FOUND");
    return profile;
  }

  async function updateProfile(userId: string, body: UpdateProfileBody): Promise<Profile> {
    await deps.updateUser(userId, {
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.locale === undefined ? {} : { locale: body.locale }),
      ...(body.timezone === undefined ? {} : { timezone: body.timezone }),
    });
    return getProfile(userId);
  }

  return {
    consentStatus,
    acceptConsents,
    listSessions,
    revokeSession,
    revokeOtherSessions,
    getProfile,
    updateProfile,
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
