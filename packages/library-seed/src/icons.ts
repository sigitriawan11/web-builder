import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SEED_DATA_DIR } from "./paths";

// CMP-192: ikon dari Lucide (lisensi ISC, bebas komersial), disimpan sebagai nama (`"icon": "phone"`), di-inline SVG
// saat publish. Versi Lucide DI-PIN (`data/lucide-icons.json` = snapshot nama untuk versi di `lucide-icons.json`).
// Upgrade versi Lucide tidak boleh membuat ikon hilang: nama yang di-rename/dihapus dipetakan `LUCIDE_ALIASES` ke
// nama saat ini; yang benar-benar hilang jatuh ke fallback `circle-help` (+ peringatan di editor).

export const FALLBACK_ICON = "circle-help";

// Alias ikon Lucide yang pernah di-rename antar versi → nama kanonik saat ini. Kosong untuk versi ter-pin sekarang;
// diisi saat upgrade Lucide bila ada ikon yang di-rename/dihapus (CMP-192: upgrade tak boleh membuat ikon hilang).
export const LUCIDE_ALIASES: Record<string, string> = {};

// Ikon merek (OPEN CMP-093/§19): Lucide tak memuat semua logo merek → pakai Simple Icons (CC0). Logo tunduk pedoman
// merek masing-masing (hanya untuk menautkan ke akun, tidak dimodifikasi). Slug = slug Simple Icons.
export const BRAND_ICONS = [
  "whatsapp",
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "x",
  "linkedin",
  "telegram",
  "line",
  "shopee",
  "tokopedia",
  "gojek",
  "grab",
  "googlemaps",
] as const;

export type IconSet = "lucide" | "brand";
export interface IconRef {
  set: IconSet;
  name: string;
}

let cachedNames: Set<string> | null = null;
export function lucideIconNames(dataDir = SEED_DATA_DIR): Set<string> {
  if (!cachedNames || dataDir !== SEED_DATA_DIR) {
    const raw = JSON.parse(readFileSync(join(dataDir, "lucide-icons.json"), "utf8")) as { names: string[] };
    const set = new Set(raw.names);
    if (dataDir === SEED_DATA_DIR) cachedNames = set;
    return set;
  }
  return cachedNames;
}

/** True bila ikon dikenali (lucide: nama/alias ada; brand: slug terdaftar). Dipakai validasi seed (CMP-192 AC). */
export function isKnownIcon(ref: IconRef, dataDir = SEED_DATA_DIR): boolean {
  if (ref.set === "brand") return (BRAND_ICONS as readonly string[]).includes(ref.name);
  const names = lucideIconNames(dataDir);
  const alias = LUCIDE_ALIASES[ref.name];
  return names.has(ref.name) || (alias !== undefined && names.has(alias));
}

/** Resolusi untuk render: nama kanonik (alias diterapkan) atau fallback `circle-help` bila lucide tak dikenal; brand
 * tak dikenal → null (pemanggil wajib menolak/menandai). `fallback` true saat jatuh ke `circle-help`. */
export function resolveIcon(ref: IconRef, dataDir = SEED_DATA_DIR): { name: string; fallback: boolean } | null {
  if (ref.set === "brand")
    return (BRAND_ICONS as readonly string[]).includes(ref.name) ? { name: ref.name, fallback: false } : null;
  const names = lucideIconNames(dataDir);
  if (names.has(ref.name)) return { name: ref.name, fallback: false };
  const alias = LUCIDE_ALIASES[ref.name];
  if (alias !== undefined && names.has(alias)) return { name: alias, fallback: false };
  return { name: FALLBACK_ICON, fallback: true };
}
