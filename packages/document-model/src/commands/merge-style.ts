import type { StylePatch } from "../schema";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Merge satu level: `null` menghapus key, nilai lain mengganti utuh. Objek kosong → undefined.
function mergeShallow(current: unknown, patch: JsonRecord): JsonRecord | undefined {
  const merged: JsonRecord = isRecord(current) ? { ...current } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) delete merged[key];
    else merged[key] = value;
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function withoutNulls(record: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, isRecord(value) ? withoutNulls(value) : value]),
  );
}

// DM-026: layout di-merge per field, kecuali `mode` berubah → objek patch dianggap lengkap untuk mode baru.
function mergeLayout(current: unknown, patch: JsonRecord): JsonRecord | undefined {
  if (patch.mode !== undefined && (!isRecord(current) || current.mode !== patch.mode)) {
    return withoutNulls(patch);
  }

  const { padding, ...rest } = patch;
  const merged = mergeShallow(current, rest) ?? {};
  if (padding === null) {
    delete merged.padding;
  } else if (isRecord(padding)) {
    const mergedPadding = mergeShallow(merged.padding, padding);
    if (mergedPadding) merged.padding = mergedPadding;
    else delete merged.padding;
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

// DM-036: position di-merge per field bila `type` sama; type berbeda → patch dianggap lengkap.
function mergePosition(current: unknown, patch: JsonRecord): JsonRecord | undefined {
  if (patch.type !== undefined && (!isRecord(current) || current.type !== patch.type)) return withoutNulls(patch);
  return mergeShallow(current, patch);
}

// DM-032/DM-036: typography objek di-merge per field; token komposit (`$token`) atomik. Patch field di atas token
// komposit butuh ekspansi token dari theme dulu — belum tersedia di sini (resolver theme T1.8.12), jadi patch
// objek di atas token mengganti utuh.
function mergeTypography(current: unknown, patch: JsonRecord): JsonRecord | undefined {
  if ("$token" in patch || (isRecord(current) && "$token" in current)) return withoutNulls(patch);
  return mergeShallow(current, patch);
}

/**
 * Menerapkan patch ke style satu breakpoint (DM-036):
 * 1. objek (`layout`, `size`, `flexChild`, `padding`, `typography`) → merge per key;
 * 2. array (`fills`, `strokes`) → replace utuh; 3. nilai atomik (`radius`, token, dimensi) → replace;
 * 4. `layout`/`position` dengan mode/type berbeda → replace; 5. `null` → hapus.
 * Mengembalikan objek baru; `current` tidak diubah.
 */
export function mergeStyle(current: JsonRecord, patch: StylePatch): JsonRecord {
  const merged: JsonRecord = { ...current };
  for (const [group, value] of Object.entries(patch)) {
    if (value === undefined) continue;

    let next: unknown;
    if (value === null) next = undefined;
    else if (group === "layout" && isRecord(value)) next = mergeLayout(merged.layout, value);
    else if ((group === "size" || group === "flexChild") && isRecord(value)) next = mergeShallow(merged[group], value);
    else if (group === "position" && isRecord(value)) next = mergePosition(merged.position, value);
    else if (group === "typography" && isRecord(value)) next = mergeTypography(merged.typography, value);
    else next = value;

    if (next === undefined) delete merged[group];
    else merged[group] = next;
  }
  return merged;
}
