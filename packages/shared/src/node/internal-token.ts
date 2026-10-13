import { z } from "zod";
import type { Result } from "../result";
import { signToken, type TokenError, verifyToken } from "./tokens";

// JWT service-to-service (ARCHITECTURE §9.3): `INTERNAL_JWT_SECRET`, `aud` = service tujuan, `sub` = service
// pemanggil, umur 60 s. Dipakai worker/realtime → api `/internal/*` dan worker → realtime `/internal/*`.

export const INTERNAL_TOKEN_TTL_SECONDS = 60;
export const InternalServiceSchema = z.enum(["api", "worker", "realtime", "web"]);
export type InternalService = z.infer<typeof InternalServiceSchema>;

const InternalClaimsSchema = z.object({ sub: InternalServiceSchema });
export type InternalClaims = z.infer<typeof InternalClaimsSchema>;

export function signInternalToken(
  secret: string,
  options: { service: InternalService; audience: InternalService; now?: () => number },
): Promise<string> {
  return signToken(
    secret,
    { sub: options.service },
    {
      audience: options.audience,
      expiresInSeconds: INTERNAL_TOKEN_TTL_SECONDS,
      ...(options.now ? { now: options.now } : {}),
    },
  );
}

export function verifyInternalToken(
  secret: string,
  token: string,
  options: { audience: InternalService; now?: () => number },
): Promise<Result<InternalClaims, TokenError>> {
  return verifyToken(secret, token, {
    audience: options.audience,
    claims: InternalClaimsSchema,
    ...(options.now ? { now: options.now } : {}),
  });
}
