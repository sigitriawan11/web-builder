import { describe, expect, it } from "vitest";
import { validateComponentDefinition } from "./component";

const label = { id: "L", en: "L" };

// Fixture M3-saja (spec §20.2 memakai fitur M7 dataList/$bind): tombol dengan variant tone + prop text/link/enum.
function buttonDef() {
  return {
    schemaVersion: 1,
    id: "cmp_buttonprimary",
    version: 1,
    name: "Button / Primary",
    category: "button" as const,
    description: "Tombol utama dengan tone.",
    propsSchema: [
      { key: "label", label, type: "text", default: "Klik" },
      { key: "link", label, type: "link" },
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
    ],
    variantAxes: [{ name: "tone", options: ["primary", "ghost"], default: "primary" }],
    variants: [{ when: { tone: "ghost" }, overrides: { n_btnroot001: { style: { base: { fills: [] } } } } }],
    rootId: "n_btnroot001",
    nodes: {
      n_btnroot001: {
        id: "n_btnroot001",
        type: "frame",
        name: "Button",
        parentId: null,
        visible: true,
        locked: false,
        tag: "div",
        children: ["n_btnlabel01"],
        style: { base: { fills: [{ type: "solid", color: { $token: "color.primary" } }] } },
        props: { role: "button", link: { $prop: "link" } },
      },
      n_btnlabel01: {
        id: "n_btnlabel01",
        type: "text",
        name: "Label",
        parentId: "n_btnroot001",
        visible: true,
        locked: false,
        tag: "span",
        style: { base: {} },
        props: { content: { $prop: "label" } },
      },
    },
  };
}

// Section dengan slot (isi default) — menguji envelope slot + slotName.
function sectionWithSlot() {
  return {
    schemaVersion: 1,
    id: "cmp_sectionslot",
    version: 1,
    name: "Section / Slot",
    category: "section" as const,
    propsSchema: [{ key: "heading", label, type: "text", default: "Judul" }],
    rootId: "n_secroot001",
    nodes: {
      n_secroot001: {
        id: "n_secroot001",
        type: "frame",
        name: "Section",
        parentId: null,
        visible: true,
        locked: false,
        tag: "section",
        children: ["n_sectitle01", "n_secslot001"],
        style: { base: {} },
        props: { role: "section" },
      },
      n_sectitle01: {
        id: "n_sectitle01",
        type: "text",
        name: "Title",
        parentId: "n_secroot001",
        visible: true,
        locked: false,
        tag: "h2",
        style: { base: {} },
        props: { content: { $prop: "heading" } },
      },
      n_secslot001: {
        id: "n_secslot001",
        type: "slot",
        name: "Body",
        parentId: "n_secroot001",
        visible: true,
        locked: false,
        children: [],
        style: { base: {} },
        props: { slotName: "body", allowedTypes: ["text", "image"] },
      },
    },
  };
}

describe("validateComponentDefinition (DM-045)", () => {
  it("fixture M3 valid (tombol + section slot)", () => {
    expect(validateComponentDefinition(buttonDef())).toMatchObject({ ok: true });
    expect(validateComponentDefinition(sectionWithSlot())).toMatchObject({ ok: true });
  });

  it("menolak self-instance langsung (SELF_INSTANCE)", () => {
    const def = buttonDef();
    (def.nodes as Record<string, unknown>).n_selfinst01 = {
      id: "n_selfinst01",
      type: "instance",
      name: "Self",
      parentId: "n_btnroot001",
      visible: true,
      locked: false,
      style: { base: {} },
      props: { componentId: "cmp_buttonprimary", version: 1 },
    };
    def.nodes.n_btnroot001.children.push("n_selfinst01");
    const result = validateComponentDefinition(def);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("SELF_INSTANCE");
  });

  it("menolak $prop yang tidak ada di propsSchema (PROP_REF_UNKNOWN)", () => {
    const def = buttonDef();
    def.nodes.n_btnlabel01.props = { content: { $prop: "tidakAda" } };
    const result = validateComponentDefinition(def);
    expect(result.issues.map((i) => i.code)).toContain("PROP_REF_UNKNOWN");
  });

  it("menolak slotName duplikat (SLOT_NAME_DUPLICATE)", () => {
    const def = sectionWithSlot();
    (def.nodes as Record<string, unknown>).n_secslot002 = {
      id: "n_secslot002",
      type: "slot",
      name: "Body 2",
      parentId: "n_secroot001",
      visible: true,
      locked: false,
      children: [],
      style: { base: {} },
      props: { slotName: "body" },
    };
    def.nodes.n_secroot001.children.push("n_secslot002");
    expect(validateComponentDefinition(def).issues.map((i) => i.code)).toContain("SLOT_NAME_DUPLICATE");
  });

  it("menolak rootId hilang (COMPONENT_ROOT) & variant axis tak dikenal (VARIANT_AXIS_UNKNOWN)", () => {
    const missingRoot = { ...buttonDef(), rootId: "n_tidakada001" };
    expect(validateComponentDefinition(missingRoot).issues.map((i) => i.code)).toContain("COMPONENT_ROOT");

    const badVariant = buttonDef();
    (badVariant as { variants: unknown }).variants = [{ when: { size: "lg" }, overrides: {} }];
    expect(validateComponentDefinition(badVariant).issues.map((i) => i.code)).toContain("VARIANT_AXIS_UNKNOWN");
  });

  it("envelope definisi rusak → COMPONENT_SCHEMA", () => {
    expect(validateComponentDefinition({ id: "bukan-cmp" }).issues[0]?.code).toBe("COMPONENT_SCHEMA");
  });
});

// DM-047: validator memeriksa kompatibilitas tipe `$prop` ↔ `PropDef.type`.
describe("validateComponentDefinition — kompatibilitas tipe $prop (DM-047)", () => {
  it("menolak text.content di-binding ke prop link (PROP_REF_TYPE)", () => {
    const def = buttonDef();
    def.nodes.n_btnlabel01.props = { content: { $prop: "link" } };
    expect(validateComponentDefinition(def).issues.map((i) => i.code)).toContain("PROP_REF_TYPE");
  });

  it("menolak fills[].color di-binding ke prop text (PROP_REF_TYPE)", () => {
    const def = buttonDef();
    def.nodes.n_btnroot001.style = { base: { fills: [{ type: "solid", color: { $prop: "label" } }] } } as never;
    expect(validateComponentDefinition(def).issues.map((i) => i.code)).toContain("PROP_REF_TYPE");
  });

  it("menolak visible di-binding ke prop non-boolean tanpa eq (PROP_REF_TYPE)", () => {
    const def = buttonDef();
    (def.nodes.n_btnlabel01 as { visible: unknown }).visible = { $prop: "label" };
    expect(validateComponentDefinition(def).issues.map((i) => i.code)).toContain("PROP_REF_TYPE");
  });

  it("menerima visible di-binding ke enum dengan eq (boolean hasil)", () => {
    const def = buttonDef();
    (def.nodes.n_btnlabel01 as { visible: unknown }).visible = { $prop: "tone", eq: "primary" };
    const codes = validateComponentDefinition(def).issues.map((i) => i.code);
    expect(codes).not.toContain("PROP_REF_TYPE");
  });

  it("menerima binding tipe yang cocok (content↔text, link↔link, color↔color)", () => {
    const def = buttonDef();
    def.propsSchema.push({ key: "bg", label, type: "color", default: { $token: "color.primary" } } as never);
    def.nodes.n_btnroot001.style = { base: { fills: [{ type: "solid", color: { $prop: "bg" } }] } } as never;
    expect(validateComponentDefinition(def)).toMatchObject({ ok: true });
  });
});
