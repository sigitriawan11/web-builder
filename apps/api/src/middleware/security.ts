import cors from "cors";
import type { RequestHandler } from "express";
import helmet from "helmet";

// Middleware 3 (ARCHITECTURE §5.3): header keamanan untuk response API (JSON, tanpa HTML).
export function securityHeaders(): RequestHandler {
  return helmet({
    // API tidak menyajikan HTML; CSP paling ketat agar respons tidak bisa dirender sebagai halaman.
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: "same-site" },
  });
}

/**
 * Middleware 4 (ARCHITECTURE §5.3): CORS HANYA untuk router publik `api.` tertentu (mis. stream SSE AI).
 * Platform API dipanggil same-origin lewat `/api` sehingga tidak dipasang global.
 */
export function corsFor(allowedOrigins: readonly string[]): RequestHandler {
  return cors({
    origin: (origin, callback) => callback(null, origin !== undefined && allowedOrigins.includes(origin)),
    credentials: true,
    maxAge: 600,
  });
}
