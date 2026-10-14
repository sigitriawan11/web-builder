import type { Block, Inline, RichTextDoc } from "../schema";

// Helper baca rich text (DM-013): baris teks per blok (list ditelusuri rekursif) & teks polos.

/** Inline per "baris blok" dalam urutan baca: paragraf/heading = satu baris; item list ditelusuri ke dalam. */
export function* textLines(doc: RichTextDoc): Generator<{ block: Block; inlines: Inline[] }> {
  const stack = [...doc.content].reverse();
  while (stack.length > 0) {
    const block = stack.pop();
    if (!block) continue;
    if (block.type === "bulletList" || block.type === "orderedList") {
      for (const item of [...block.content].reverse()) stack.push(...[...item.content].reverse());
      continue;
    }
    yield { block, inlines: block.content ?? [] };
  }
}

/**
 * Teks polos (AC DM-013) untuk outline AI, deskripsi SEO otomatis, dan pencarian: blok dipisah baris baru,
 * `hardBreak` = baris baru, mark diabaikan.
 */
export function plainText(doc: RichTextDoc): string {
  const lines: string[] = [];
  for (const { inlines } of textLines(doc)) {
    lines.push(inlines.map((inline) => (inline.type === "text" ? inline.text : "\n")).join(""));
  }
  return lines.join("\n");
}
