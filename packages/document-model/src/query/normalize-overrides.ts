import { mergeStyle } from "../ops/merge-style";
import type { ResponsiveStyle, StylePatch } from "../schema";

// DM-036: override breakpoint yang tidak mengubah hasil cascade dibuang, agar perubahan base berikutnya tetap
// mengalir ke tablet/mobile dan patch tetap sparse. Dipanggil command setelah menulis style.

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => jsonEqual(item, b[i]));
  }
  if (!isRecord(a) || !isRecord(b)) return false;
  const keys = Object.keys(a).filter((key) => a[key] !== undefined);
  return (
    keys.length === Object.keys(b).filter((key) => b[key] !== undefined).length &&
    keys.every((key) => jsonEqual(a[key], b[key]))
  );
}

// Buang key (dan key objek bersarang satu tingkat, mis. `padding`) yang tidak memengaruhi hasil merge.
function pruneGroup(inherited: JsonRecord, group: string, value: unknown): unknown {
  const result = (candidate: unknown) => mergeStyle(inherited, { [group]: candidate } as StylePatch)[group];
  const target = result(value);
  if (jsonEqual(target, inherited[group])) return undefined;
  if (!isRecord(value)) return value;

  let pruned: JsonRecord = { ...value };
  for (const key of Object.keys(value)) {
    const { [key]: removed, ...without } = pruned;
    if (jsonEqual(result(without), target)) {
      pruned = without;
      continue;
    }
    if (isRecord(removed)) {
      let inner: JsonRecord = { ...removed };
      for (const innerKey of Object.keys(removed)) {
        const { [innerKey]: _, ...innerWithout } = inner;
        if (jsonEqual(result({ ...pruned, [key]: innerWithout }), target)) inner = innerWithout;
      }
      pruned = { ...pruned, [key]: inner };
    }
  }
  return pruned;
}

function normalizePatch(inherited: JsonRecord, patch: StylePatch | undefined): StylePatch | undefined {
  if (!patch) return undefined;
  const normalized: JsonRecord = {};
  for (const [group, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const pruned = pruneGroup(inherited, group, value);
    if (pruned !== undefined) normalized[group] = pruned;
  }
  return Object.keys(normalized).length > 0 ? (normalized as StylePatch) : undefined;
}

/** Style dengan override tablet/mobile yang redundan dihapus; patch kosong → breakpoint tidak ada. */
export function normalizeOverrides(style: ResponsiveStyle): ResponsiveStyle {
  const base = style.base as JsonRecord;
  const tablet = normalizePatch(base, style.tablet);
  const tabletEffective = tablet ? mergeStyle(base, tablet) : base;
  const mobile = normalizePatch(tabletEffective, style.mobile);
  return { base: style.base, ...(tablet ? { tablet } : {}), ...(mobile ? { mobile } : {}) };
}
