import { z } from "zod";
import { UuidV7Schema } from "../ids";
import { WorkspaceRoleSchema } from "./workspaces";

// `POST /api/v1/realtime/token` (ARCHITECTURE §3, §7.3): JWT 5 menit untuk koneksi Hocuspocus satu dokumen.

export const REALTIME_TOKEN_TTL_SECONDS = 300;

export const RealtimeTokenBodySchema = z.object({
  docId: UuidV7Schema,
});

export const RealtimeTokenResponseSchema = z.object({
  token: z.string().min(1),
  url: z.string().regex(/^wss?:\/\//, "harus URL WebSocket"),
  expiresAt: z.iso.datetime(),
});

// Diverifikasi `apps/realtime` onAuthenticate; dokumen yang diminta harus sama dengan `docId` (ARCHITECTURE §5.5).
export const RealtimeTokenClaimsSchema = z.object({
  sub: UuidV7Schema, // userId
  docId: UuidV7Schema,
  siteId: UuidV7Schema.nullable(),
  role: WorkspaceRoleSchema,
  exp: z.number().int().positive(), // detik Unix (JWT)
});

export type RealtimeTokenBody = z.infer<typeof RealtimeTokenBodySchema>;
export type RealtimeTokenResponse = z.infer<typeof RealtimeTokenResponseSchema>;
export type RealtimeTokenClaims = z.infer<typeof RealtimeTokenClaimsSchema>;
