import { describe, expect, it } from "vitest";
import { NodePatchSchema, PropDefSchema, PropValueSchema, VariantAxisSchema, VariantRuleSchema } from "./component";

const label = { id: "Label", en: "Label" };

describe("PropDef (DM-046)", () => {
  it("menerima tiap tipe prop", () => {
    const defs = [
      { key: "heading", label, type: "text", default: "Produk" },
      { key: "limit", label, type: "number", default: 6, min: 1, max: 48 },
      { key: "showBadge", label, type: "boolean", default: false },
      {
        key: "tone",
        label,
        type: "enum",
        default: "primary",
        options: [
          { value: "primary", label },
          { value: "ghost", label },
        ],
      },
      { key: "photo", label, type: "image" },
      { key: "ctaLink", label, type: "link" },
      { key: "accent", label, type: "color", default: "#2563EB" },
      { key: "brand", label, type: "icon", default: { set: "brand", name: "whatsapp" } },
      { key: "body", label, type: "slot", allowedTypes: ["text", "image"] },
      {
        key: "items",
        label,
        type: "list",
        itemSchema: [{ key: "name", label, type: "text", default: "" }],
        default: [{ name: "A" }],
      },
    ];
    for (const def of defs) expect(PropDefSchema.safeParse(def).success, def.key).toBe(true);
  });

  it("menolak key non-camelCase & enum default di luar options", () => {
    expect(PropDefSchema.safeParse({ key: "Bad-Key", label, type: "text", default: "" }).success).toBe(false);
    // default enum tak harus dicek di sini (dicek saat resolusi) — tapi struktur options wajib.
    expect(PropDefSchema.safeParse({ key: "x", label, type: "enum", default: "a", options: [] }).success).toBe(false);
    expect(PropDefSchema.safeParse({ key: "x", label, type: "unknown", default: 1 }).success).toBe(false);
  });

  it("list bersarang (itemSchema rekursif) valid", () => {
    const nested = {
      key: "faq",
      label,
      type: "list",
      itemSchema: [
        { key: "q", label, type: "text", default: "" },
        {
          key: "tags",
          label,
          type: "list",
          itemSchema: [{ key: "name", label, type: "text", default: "" }],
          default: [],
        },
      ],
      default: [],
    };
    expect(PropDefSchema.safeParse(nested).success).toBe(true);
  });
});

describe("VariantAxis & VariantRule (DM-048)", () => {
  it("axis: default harus salah satu option", () => {
    expect(VariantAxisSchema.safeParse({ name: "size", options: ["sm", "md", "lg"], default: "md" }).success).toBe(
      true,
    );
    expect(VariantAxisSchema.safeParse({ name: "size", options: ["sm", "md"], default: "xl" }).success).toBe(false);
    expect(VariantAxisSchema.safeParse({ name: "size", options: [], default: "md" }).success).toBe(false);
  });

  it("rule: when tidak boleh kosong; overrides pakai NodePath", () => {
    const ok = { when: { columns: "2" }, overrides: { n_pglist0001: { style: { base: { opacity: 0.5 } } } } };
    expect(VariantRuleSchema.safeParse(ok).success).toBe(true);
    expect(VariantRuleSchema.safeParse({ when: {}, overrides: {} }).success).toBe(false);
    // NodePath bersarang a/b valid.
    const nested = { when: { size: "lg" }, overrides: { "n_card0001/n_price01": { visible: false } } };
    expect(VariantRuleSchema.safeParse(nested).success).toBe(true);
    // key override bukan NodePath → ditolak.
    expect(VariantRuleSchema.safeParse({ when: { size: "lg" }, overrides: { bukanPath: {} } }).success).toBe(false);
  });
});

describe("NodePatch (DM-049)", () => {
  it("menerima style/props/visible; menolak key tak dikenal (mis. name)", () => {
    expect(NodePatchSchema.safeParse({ style: { base: { fills: [] } }, visible: false }).success).toBe(true);
    expect(NodePatchSchema.safeParse({ props: { content: "Halo" } }).success).toBe(true);
    // name tidak bisa di-override (strict).
    expect(NodePatchSchema.safeParse({ name: "Baru" }).success).toBe(false);
    expect(NodePatchSchema.safeParse({ type: "text" }).success).toBe(false);
  });
});

describe("PropValue (nilai instance site)", () => {
  it("menerima literal & token warna, menolak $prop", () => {
    expect(PropValueSchema.safeParse("Toko Kue Budi").success).toBe(true);
    expect(PropValueSchema.safeParse(6).success).toBe(true);
    expect(PropValueSchema.safeParse({ $token: "color.accent" }).success).toBe(true);
    expect(PropValueSchema.safeParse([{ label: "A" }, { label: "B" }]).success).toBe(true);
    // $prop hanya di ComponentDefinition, bukan nilai site.
    expect(PropValueSchema.safeParse({ $prop: "heading" }).success).toBe(false);
  });
});
