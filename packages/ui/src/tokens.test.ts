import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// ED-012 AC: komponen UI memenuhi kontras WCAG AA di light & dark. Diuji pada token (sumber semua warna komponen).
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`blok ${selector} tidak ada`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1] ?? "", m[2] ?? ""]));
}

const light = block(":root");
const dark = block(".dark");
const darkSystem = block(":root:not(.light)");

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// [teks/elemen, latar, minimum]: teks 4.5:1 (WCAG 1.4.3), komponen UI & fokus 3:1 (WCAG 1.4.11).
const PAIRS: ReadonlyArray<readonly [string, string, number]> = [
  ["foreground", "background", 4.5],
  ["card-foreground", "card", 4.5],
  ["popover-foreground", "popover", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["secondary-foreground", "secondary", 4.5],
  ["muted-foreground", "muted", 4.5],
  ["muted-foreground", "background", 4.5],
  ["muted-foreground", "card", 4.5],
  ["accent-foreground", "accent", 4.5],
  ["destructive-foreground", "destructive", 4.5],
  ["success-foreground", "success", 4.5],
  ["warning-foreground", "warning", 4.5],
  // Teks berwarna di atas latar (link, pesan error/sukses/peringatan di Alert).
  ["primary", "background", 4.5],
  ["destructive", "card", 4.5],
  ["success", "card", 4.5],
  ["warning", "card", 4.5],
  ["input", "background", 3],
  ["ring", "background", 3],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("kontras token %s (WCAG AA)", (_name, tokens) => {
  it.each(PAIRS)("%s di atas %s ≥ %s:1", (fg, bg, minimum) => {
    const a = tokens[fg];
    const b = tokens[bg];
    expect(a, `token --${fg}`).toBeDefined();
    expect(b, `token --${bg}`).toBeDefined();
    expect(contrast(a ?? "", b ?? "")).toBeGreaterThanOrEqual(minimum);
  });
});

describe("konsistensi blok token", () => {
  it("token gelap kelas `.dark` = token gelap OS (`:root:not(.light)`)", () => {
    expect(darkSystem).toEqual(dark);
  });

  it("setiap token warna terang punya pasangan gelap", () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it("rumus kontras: hitam/putih 21:1, warna sama 1:1", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#4f46e5", "#4f46e5")).toBe(1);
  });
});
