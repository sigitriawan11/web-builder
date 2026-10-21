import { createHash } from "node:crypto";

// Serialisasi kanonik: key objek diurutkan rekursif → hash stabil walau jsonb Postgres tidak menjamin urutan key
// saat dibaca kembali (dipakai verifikasi integritas versi library, CMP-044).
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonicalize(record[key])]),
    );
  }
  return value;
}

/** SHA-256 hex atas serialisasi kanonik (key terurut) — stabil untuk round-trip jsonb. */
export function stableHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}
