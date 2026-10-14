import type { Db } from "@platform/db";
import { AppError, can } from "@platform/shared";
import {
  REALTIME_TOKEN_AUDIENCE,
  REALTIME_TOKEN_TTL_SECONDS,
  type RealtimeTokenClaims,
  type RealtimeTokenResponse,
} from "@platform/shared/contracts";
import { signToken } from "@platform/shared/node";
import { findSiteDocumentAccess } from "./realtime-token.repository";

// `POST /v1/realtime/token` (ARCHITECTURE §5.5, §7.3): JWT 5 menit untuk koneksi Hocuspocus SATU dokumen.
// `role` ikut di klaim agar realtime bisa memberi akses baca-saja (viewer) tanpa query ulang.

export interface RealtimeTokenDeps {
  db: Db;
  secret: string;
  // URL WebSocket publik (PUBLIC_REALTIME_URL).
  url: string;
  now?: () => number;
}

export function createRealtimeTokenService(deps: RealtimeTokenDeps) {
  return {
    async issue(userId: string, documentId: string): Promise<RealtimeTokenResponse> {
      const access = await findSiteDocumentAccess(deps.db, userId, documentId);
      // Bukan anggota / dokumen tidak ada / situs dihapus → 404 (keberadaan tidak bocor).
      if (!access) throw new AppError("NOT_FOUND");
      if (!can({ role: access.role, userId }, "site.read")) {
        throw new AppError("FORBIDDEN", undefined, { action: "site.read" });
      }
      const nowMs = deps.now?.() ?? Date.now();
      const claims: Omit<RealtimeTokenClaims, "exp"> = {
        sub: userId,
        docId: access.documentId,
        siteId: access.siteId,
        role: access.role,
      };
      const token = await signToken(deps.secret, claims, {
        expiresInSeconds: REALTIME_TOKEN_TTL_SECONDS,
        audience: REALTIME_TOKEN_AUDIENCE,
        now: () => nowMs,
      });
      const expiresAt = new Date((Math.floor(nowMs / 1000) + REALTIME_TOKEN_TTL_SECONDS) * 1000).toISOString();
      return { token, url: deps.url, expiresAt };
    },
  };
}

export type RealtimeTokenService = ReturnType<typeof createRealtimeTokenService>;
