import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { SEED_DATA_DIR } from "./paths";

// CMP-191: hanya font Google Fonts (lisensi SIL OFL 1.1 / Apache 2.0) boleh dipakai library & theme preset. Font
// di-self-host (Fontsource) saat publish; subset latin + latin-ext. Daftar ini = sumber kebenaran font yang diizinkan;
// `fontsourceId` = paket npm `@fontsource/<id>`. Lisensi disimpan agar audit (QA) tidak meloloskan font tanpa lisensi.

const FONT_LICENSES = ["OFL-1.1", "Apache-2.0"] as const;

export const SeedFontSchema = z.strictObject({
  // Nama family seperti dirender CSS (mis. "Inter").
  family: z.string().min(1).max(60),
  // Slug paket Fontsource (`@fontsource/<id>`), kebab-case.
  fontsourceId: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "fontsourceId kebab-case"),
  license: z.enum(FONT_LICENSES),
  category: z.enum(["sans-serif", "serif", "display", "monospace"]),
  subsets: z.array(z.enum(["latin", "latin-ext"])).min(1),
  // Bobot yang disediakan (self-host subset). 400 wajib (teks dasar).
  weights: z.array(z.number().int().min(100).max(900)).min(1),
});

export const SeedFontsFileSchema = z
  .strictObject({ seedVersion: z.literal(1), fonts: z.array(SeedFontSchema).min(1) })
  .superRefine((file, ctx) => {
    const seen = new Map<string, number>();
    file.fonts.forEach((font, index) => {
      const first = seen.get(font.family.toLowerCase());
      if (first !== undefined)
        ctx.addIssue({
          code: "custom",
          path: ["fonts", index, "family"],
          message: `family "${font.family}" duplikat (lihat indeks ${first})`,
        });
      else seen.set(font.family.toLowerCase(), index);
      if (!font.weights.includes(400))
        ctx.addIssue({ code: "custom", path: ["fonts", index, "weights"], message: "wajib memuat bobot 400" });
      if (!font.subsets.includes("latin"))
        ctx.addIssue({ code: "custom", path: ["fonts", index, "subsets"], message: "wajib memuat subset latin" });
    });
  });

export type SeedFont = z.infer<typeof SeedFontSchema>;
export const ALLOWED_FONT_LICENSES = FONT_LICENSES;

export function loadFonts(dataDir = SEED_DATA_DIR): SeedFont[] {
  const raw: unknown = JSON.parse(readFileSync(join(dataDir, "fonts.json"), "utf8"));
  return SeedFontsFileSchema.parse(raw).fonts;
}
