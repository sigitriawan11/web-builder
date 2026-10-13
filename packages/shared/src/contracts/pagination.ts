import { z } from "zod";

// Cursor pagination (ARCHITECTURE §5.3): cursor opaque bagi klien = base64url dari JSON posisi terakhir
// (mis. `{ id }` UUIDv7 yang terurut waktu). Server memvalidasi isi cursor dengan schema-nya sendiri.

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export const CursorQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

export type CursorQuery = z.infer<typeof CursorQuerySchema>;

// btoa/atob & TextEncoder/TextDecoder ada di Node 22, browser, dan Workers; tipenya tidak ada di lib ES2022
// paket isomorfik ini, jadi diambil dari globalThis dengan tipe minimal.
const { btoa, atob, TextEncoder, TextDecoder } = globalThis as unknown as {
  btoa(data: string): string;
  atob(data: string): string;
  TextEncoder: new () => { encode(input: string): Uint8Array };
  TextDecoder: new () => { decode(input: Uint8Array): string };
};

export function encodeCursor(position: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(position));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** Cursor rusak/dimanipulasi → `null` (API menjawab `VALIDATION_FAILED`), tidak pernah melempar. */
export function decodeCursor<T extends z.ZodType>(schema: T, cursor: string): z.infer<T> | null {
  try {
    const binary = atob(cursor.replaceAll("-", "+").replaceAll("_", "/"));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = schema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
