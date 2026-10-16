// ED-032 / ED-033: path page dari judul. Slug ASCII huruf kecil + angka + "-" (sesuai `PAGE_PATH_PATTERN`
// DM-010); karakter non-ASCII di-transliterasi (é → e) atau dibuang. Dipakai editor & AI tools.

const MAX_SEGMENT = 60;

/** "Tentang Kami!" → "tentang-kami"; kosong bila tidak ada huruf/angka. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " dan ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SEGMENT)
    .replace(/-+$/g, "");
}

/** Path unik dari judul: `/tentang-kami`, bentrok → `/tentang-kami-2`, …; judul tanpa huruf → `/page`. */
export function uniquePagePath(title: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = `/${slugify(title) || "page"}`;
  if (!used.has(base)) return base;
  for (let suffix = 2; ; suffix++) {
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

export type PagePathError = "format" | "taken" | "homeIsRoot" | "rootIsHome";

// Sama dengan PAGE_PATH_PATTERN schema (DM-010): "/" atau segmen huruf kecil/angka/"-" (dinamis `[slug]` = M7).
const PATH_PATTERN = /^\/$|^(\/([a-z0-9-]+|\[[a-z][a-zA-Z0-9]*\]))+$/;

/**
 * ED-032/ED-033: validasi path page di klien dengan aturan yang sama dengan command (`createPage`/`updatePage`):
 * format slug, unik per situs, home tepat di "/", page lain tidak boleh "/".
 */
export function validatePagePath(
  path: string,
  page: { id: string; isHome: boolean },
  pages: readonly { id: string; path: string }[],
): PagePathError | null {
  if (path.length > 200 || !PATH_PATTERN.test(path)) return "format";
  if (page.isHome && path !== "/") return "homeIsRoot";
  if (!page.isHome && path === "/") return "rootIsHome";
  if (pages.some((other) => other.id !== page.id && other.path === path)) return "taken";
  return null;
}

/** Normalisasi input path user: "Tentang Kami" / "tentang kami/" → "/tentang-kami" (per segmen di-slugify). */
export function normalizePagePath(input: string): string {
  const segments = input
    .split("/")
    .map((segment) => slugify(segment))
    .filter(Boolean);
  return `/${segments.join("/")}`;
}
