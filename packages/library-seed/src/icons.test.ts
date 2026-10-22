import { describe, expect, it } from "vitest";
import { loadCategories } from "./categories";
import { readComponentFiles, SeedComponentFileSchema } from "./component";
import {
  BRAND_ICONS,
  FALLBACK_ICON,
  type IconRef,
  type IconSet,
  isKnownIcon,
  LUCIDE_ALIASES,
  lucideIconNames,
  resolveIcon,
} from "./icons";

// T3.9.3 / CMP-192: ikon yang dirujuk seed (kategori + node component) wajib ADA (lucide pinned / alias / brand).
// Fallback `circle-help` valid; alias menunjuk nama lucide valid; upgrade lucide tak membuat ikon hilang.

function iconRefs(value: unknown): IconRef[] {
  if (Array.isArray(value)) return value.flatMap(iconRefs);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: IconRef[] = [];
    if (obj.type === "icon" && obj.props && typeof obj.props === "object") {
      const props = obj.props as Record<string, unknown>;
      if ((props.set === "lucide" || props.set === "brand") && typeof props.name === "string")
        out.push({ set: props.set as IconSet, name: props.name });
    }
    for (const child of Object.values(obj)) out.push(...iconRefs(child));
    return out;
  }
  return [];
}

describe("ikon seed (CMP-192)", () => {
  const names = lucideIconNames();

  it("snapshot nama lucide ter-pin & memuat ikon", () => {
    expect(names.size).toBeGreaterThan(1000);
  });

  it("fallback `circle-help` adalah nama lucide valid", () => {
    expect(names.has(FALLBACK_ICON)).toBe(true);
  });

  it("setiap alias menunjuk nama lucide yang valid", () => {
    for (const target of Object.values(LUCIDE_ALIASES)) {
      expect(names.has(target), `alias target "${target}" bukan ikon lucide`).toBe(true);
    }
  });

  it("brand icons tidak kosong & slug valid", () => {
    expect(BRAND_ICONS.length).toBeGreaterThan(0);
    for (const slug of BRAND_ICONS) expect(slug).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });

  it("setiap ikon kategori (lucide) dikenali", () => {
    for (const category of loadCategories()) {
      if (category.icon === undefined) continue;
      expect(
        isKnownIcon({ set: "lucide", name: category.icon }),
        `kategori "${category.slug}" ikon "${category.icon}"`,
      ).toBe(true);
    }
  });

  it("setiap node ikon di seed component dikenali (lucide/alias/brand)", () => {
    for (const file of readComponentFiles()) {
      const seed = SeedComponentFileSchema.parse(file.json);
      for (const ref of iconRefs(seed)) {
        expect(isKnownIcon(ref), `${file.path}: ikon ${ref.set}/${ref.name}`).toBe(true);
      }
    }
  });

  it("resolveIcon: lucide tak dikenal → fallback; brand tak dikenal → null", () => {
    expect(resolveIcon({ set: "lucide", name: "ikon-tak-ada-xyz" })).toEqual({ name: FALLBACK_ICON, fallback: true });
    expect(resolveIcon({ set: "brand", name: "merek-tak-ada" })).toBeNull();
    expect(resolveIcon({ set: "brand", name: BRAND_ICONS[0] })).toEqual({ name: BRAND_ICONS[0], fallback: false });
  });
});
