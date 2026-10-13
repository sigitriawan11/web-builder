import { AppError } from "@platform/shared";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { z } from "zod";

// Middleware 10 (ARCHITECTURE §5.3): validasi params/query/body dengan Zod di boundary. Hasil parse disimpan di
// `req.valid` (Express 5: `req.query` read-only, jadi tidak ditimpa). Gagal → AppError VALIDATION_FAILED 422 dengan
// `details.issues` = { location, path, code, message } — tanpa nilai input (bisa berisi secret).

export interface RequestSchemas {
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
}

type Location = keyof RequestSchemas;
type InferPart<S extends RequestSchemas, K extends Location> = S[K] extends z.ZodType ? z.infer<S[K]> : undefined;

export type Valid<S extends RequestSchemas> = { [K in Location]: InferPart<S, K> };

export interface ValidationIssue {
  location: Location;
  path: string;
  code: string;
  message: string;
}

const LOCATIONS: Location[] = ["params", "query", "body"];

function parseAll<S extends RequestSchemas>(schemas: S, req: Request): Valid<S> {
  const issues: ValidationIssue[] = [];
  const valid: Partial<Record<Location, unknown>> = {};
  for (const location of LOCATIONS) {
    const schema = schemas[location];
    if (!schema) continue;
    const result = schema.safeParse(req[location]);
    if (result.success) valid[location] = result.data;
    else {
      for (const issue of result.error.issues) {
        issues.push({ location, path: issue.path.map(String).join("."), code: issue.code, message: issue.message });
      }
    }
  }
  if (issues.length > 0) throw new AppError("VALIDATION_FAILED", 422, { issues });
  return valid as Valid<S>;
}

/** Middleware validasi; hasil di `req.valid` (bertipe `unknown` — pakai `validated()` untuk handler bertipe). */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    req.valid = parseAll(schemas, req);
    next();
  };
}

export type ValidatedHandler<S extends RequestSchemas> = (
  req: Request & { valid: Valid<S> },
  res: Response,
  next: NextFunction,
) => unknown;

/** `router.post(path, ...validated(schemas, (req, res) => …))` — `req.valid` bertipe dari schema, tanpa cast. */
export function validated<S extends RequestSchemas>(schemas: S, handler: ValidatedHandler<S>): RequestHandler[] {
  return [validate(schemas), (req, res, next) => handler(req as Request & { valid: Valid<S> }, res, next)];
}
