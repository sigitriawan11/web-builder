// ED-033: pratinjau snippet Google — judul ±60 karakter, deskripsi ±160 karakter, dipotong di batas kata + "…".
export const SNIPPET_TITLE_MAX = 60;
export const SNIPPET_DESCRIPTION_MAX = 160;

export function truncateSnippet(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  // Potong di spasi terakhir bila tidak terlalu jauh (seperti Google); selain itu potong keras.
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:-]+$/, "")}…`;
}
