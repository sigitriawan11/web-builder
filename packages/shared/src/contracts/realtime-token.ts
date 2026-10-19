import { z } from "zod";
import { UuidV7Schema } from "../ids";
import { WorkspaceRoleSchema } from "./workspaces";

// `POST /api/v1/realtime/token` (ARCHITECTURE §3, §7.3): JWT 5 menit untuk koneksi Hocuspocus satu dokumen.

export const REALTIME_TOKEN_TTL_SECONDS = 300;
// `aud` JWT: api menandatangani, apps/realtime memverifikasi dengan nilai yang sama.
export const REALTIME_TOKEN_AUDIENCE = "realtime";

export const RealtimeTokenBodySchema = z.object({
  docId: UuidV7Schema,
});

export const RealtimeTokenResponseSchema = z.object({
  token: z.string().min(1),
  url: z.string().regex(/^wss?:\/\//, "harus URL WebSocket"),
  expiresAt: z.iso.datetime(),
});

// Diverifikasi `apps/realtime` onAuthenticate; dokumen yang diminta harus sama dengan `docId` (ARCHITECTURE §5.5).
// `kind` = jenis dokumen: `site` (default, token tenant) atau `component` (Mode Admin, token staf — CMP-010). Untuk
// component, `siteId` null & `role` memetakan kapabilitas staf ke peran edit/baca (`editor`=bisa edit, `viewer`=baca
// saja) agar logika read-only realtime berlaku tanpa perubahan.
export const RealtimeTokenClaimsSchema = z.object({
  sub: UuidV7Schema, // userId
  docId: UuidV7Schema,
  siteId: UuidV7Schema.nullable(),
  role: WorkspaceRoleSchema,
  kind: z.enum(["site", "component"]).default("site"),
  exp: z.number().int().positive(), // detik Unix (JWT)
});

export type RealtimeTokenBody = z.infer<typeof RealtimeTokenBodySchema>;
export type RealtimeTokenResponse = z.infer<typeof RealtimeTokenResponseSchema>;
export type RealtimeTokenClaims = z.infer<typeof RealtimeTokenClaimsSchema>;
