import {
  REALTIME_TOKEN_AUDIENCE,
  type RealtimeTokenClaims,
  RealtimeTokenClaimsSchema,
} from "@platform/shared/contracts";
import { verifyToken } from "@platform/shared/node";

// ARCHITECTURE §5.5: JWT pendek dari api (`POST /v1/realtime/token`) — satu token = satu dokumen.

/** Konteks koneksi Hocuspocus setelah autentikasi (dipakai extension: persistence, lock, projections). */
export interface RealtimeContext {
  userId: string;
  docId: string;
  siteId: string | null;
  role: RealtimeTokenClaims["role"];
}

export type AuthFailure = "INVALID" | "EXPIRED" | "DOCUMENT_MISMATCH";

export class RealtimeAuthError extends Error {
  // Hocuspocus mengirim `error.reason` (bila ada) ke klien — jangan pakai nama itu: detail (kedaluwarsa, dokumen lain)
  // hanya untuk log; klien cukup tahu ditolak lalu meminta token baru.
  constructor(readonly failure: AuthFailure) {
    super("permission-denied");
    this.name = "RealtimeAuthError";
  }
}

export async function authenticateConnection(
  secret: string,
  token: string,
  documentName: string,
  now?: () => number,
): Promise<RealtimeContext> {
  const result = await verifyToken(secret, token, {
    audience: REALTIME_TOKEN_AUDIENCE,
    claims: RealtimeTokenClaimsSchema,
    ...(now ? { now } : {}),
  });
  if (!result.ok) throw new RealtimeAuthError(result.error);
  const claims = result.value;
  // Dokumen yang diminta harus sama dengan `docId` di token.
  if (claims.docId !== documentName) throw new RealtimeAuthError("DOCUMENT_MISMATCH");
  return { userId: claims.sub, docId: claims.docId, siteId: claims.siteId, role: claims.role };
}
