import { errors, jwtVerify, SignJWT } from "jose";
import type { z } from "zod";
import { err, ok, type Result } from "../result";

// JWT pendek HS256 untuk service-to-service & token browser berumur pendek (ARCHITECTURE §9.3, §5.5):
// realtime token (5 menit), internal JWT (`aud` per service, 60 s), AI stream token (10 menit).
// Klaim divalidasi Zod setelah tanda tangan & `exp`/`aud` lolos.

export const MIN_SECRET_LENGTH = 32;

export type TokenError = "INVALID" | "EXPIRED";

function keyFrom(secret: string): Uint8Array {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new RangeError(`Secret JWT minimal ${MIN_SECRET_LENGTH} karakter`);
  }
  return new TextEncoder().encode(secret);
}

export interface SignTokenOptions {
  expiresInSeconds: number;
  audience: string;
  // Untuk test.
  now?: () => number;
}

export async function signToken(
  secret: string,
  claims: Record<string, unknown>,
  options: SignTokenOptions,
): Promise<string> {
  const issuedAt = Math.floor((options.now?.() ?? Date.now()) / 1000);
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + options.expiresInSeconds)
    .setAudience(options.audience)
    .sign(keyFrom(secret));
}

export interface VerifyTokenOptions<T extends z.ZodType> {
  audience: string;
  claims: T;
  now?: () => number;
}

/**
 * Verifikasi tanda tangan (HANYA HS256 — mencegah serangan `alg: none`/algorithm confusion), `exp`, `aud`,
 * lalu bentuk klaim. Tidak melempar untuk token buruk: kembalikan `INVALID`/`EXPIRED` agar pemanggil memetakan
 * ke 401 tanpa membocorkan alasan detail.
 */
export async function verifyToken<T extends z.ZodType>(
  secret: string,
  token: string,
  options: VerifyTokenOptions<T>,
): Promise<Result<z.infer<T>, TokenError>> {
  try {
    const { payload } = await jwtVerify(token, keyFrom(secret), {
      algorithms: ["HS256"],
      audience: options.audience,
      requiredClaims: ["exp"],
      ...(options.now ? { currentDate: new Date(options.now()) } : {}),
    });
    const parsed = options.claims.safeParse(payload);
    return parsed.success ? ok(parsed.data) : err("INVALID");
  } catch (error) {
    if (error instanceof errors.JWTExpired) return err("EXPIRED");
    if (error instanceof errors.JOSEError) return err("INVALID");
    throw error;
  }
}
