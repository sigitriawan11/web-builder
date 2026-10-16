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
