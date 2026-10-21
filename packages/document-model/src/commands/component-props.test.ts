import { describe, expect, it } from "vitest";
import type { ComponentDefinition, PropDef } from "../schema/component";
import { ComponentNodeSchema, validateComponentDefinition } from "../validate/component";
import { componentDefToYDoc, yDocToComponentDef } from "../yjs/component-mapping";
import { userOrigin } from "../yjs/origin";
import { type CommandContext, runCommand } from "./command";
import {
  addComponentProp,
  bindProp,
  removeComponentProp,
  setNodeAccess,
  setRepeatProp,
  unbindProp,
  updateComponentProp,
} from "./component-props";
import { addVariantAxis, removeVariantAxis, updateVariantAxis } from "./component-variants";

const TEXT_PROP: PropDef = { key: "title", label: { id: "Judul", en: "Title" }, type: "text", default: "Halo" };
const BOOL_PROP: PropDef = {
  key: "showSub",
  label: { id: "Subjudul?", en: "Subtitle?" },
  type: "boolean",
  default: true,
};

function baseDef(): ComponentDefinition {
  return {
    schemaVersion: 1,
    id: "cmp_props0001",
    version: 1,
    name: "Card",
    category: "card",
    propsSchema: [],
    rootId: "n_root0001",
    nodes: {
      n_root0001: {
        id: "n_root0001",
        type: "frame",
        name: "Root",
        parentId: null,
        visible: true,
        locked: false,
        tag: "div",
        children: ["n_text0001"],
        style: { base: {} },
        props: {},
      },
      n_text0001: {
        id: "n_text0001",
        type: "text",
        name: "Title",
        parentId: "n_root0001",
        visible: true,
        locked: false,
        tag: "p",
        style: { base: {} },
        props: { content: { type: "doc", content: [] } },
      },
    },
  };
}

// Node ComponentDefinition bertipe longgar (style/props/visible permisif) → cast ke bentuk yang kita periksa.
type LooseNode = {
  props?: { content?: unknown; repeatProp?: unknown };
  visible?: unknown;
  style?: { base?: { fills?: { color?: unknown } } };
};

function setup() {
  const doc = componentDefToYDoc(baseDef());
  const ctx: CommandContext = { doc, origin: userOrigin("test"), nodeSchema: ComponentNodeSchema };
  const read = (): ComponentDefinition => {
    const result = validateComponentDefinition(yDocToComponentDef(doc));
    if (!result.ok) throw new Error(`invalid: ${result.issues[0]?.message.en}`);
    return result.definition as ComponentDefinition;
  };
  const node = (id: string): LooseNode => read().nodes[id] as LooseNode;
  return { doc, ctx, read, node };
}

describe("command props component (CMP-020)", () => {
  it("addComponentProp menambah prop; key duplikat → gagal", () => {
    const h = setup();
    const added = runCommand(h.ctx, addComponentProp, { prop: TEXT_PROP });
    expect(added.ok).toBe(true);
    expect(h.read().propsSchema).toEqual([TEXT_PROP]);

    const dup = runCommand(h.ctx, addComponentProp, { prop: TEXT_PROP });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe("INVALID_TARGET");
  });

  it("updateComponentProp mengganti definisi; rename key ditolak; tak ada → NOT_FOUND", () => {
    const h = setup();
    runCommand(h.ctx, addComponentProp, { prop: TEXT_PROP });
    const updated = runCommand(h.ctx, updateComponentProp, {
      key: "title",
      prop: { ...TEXT_PROP, label: { id: "Judul Baru", en: "New Title" }, default: "Hai" },
    });
    expect(updated.ok).toBe(true);
    expect(h.read().propsSchema[0]).toMatchObject({ key: "title", default: "Hai" });

    const renamed = runCommand(h.ctx, updateComponentProp, { key: "title", prop: { ...TEXT_PROP, key: "heading" } });
    expect(renamed.ok).toBe(false);
    if (!renamed.ok) expect(renamed.error.code).toBe("INVALID_INPUT");

    const missing = runCommand(h.ctx, updateComponentProp, { key: "nope", prop: { ...TEXT_PROP, key: "nope" } });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("NOT_FOUND");
  });
});

describe("command binding prop → node (CMP-021)", () => {
  it("bind content teks ke $prop (round-trip + valid); prop tak dikenal → NOT_FOUND", () => {
    const h = setup();
    runCommand(h.ctx, addComponentProp, { prop: TEXT_PROP });
    const bound = runCommand(h.ctx, bindProp, {
      nodeId: "n_text0001",
      path: { field: "prop", key: "content" },
      propKey: "title",
    });
    expect(bound.ok).toBe(true);
    expect(h.node("n_text0001").props?.content).toEqual({ $prop: "title" });

    const unknown = runCommand(h.ctx, bindProp, {
      nodeId: "n_text0001",
      path: { field: "prop", key: "content" },
      propKey: "ghost",
    });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.code).toBe("NOT_FOUND");
  });

  it("bind visible ke boolean, lalu unbind mengembalikan visible=true", () => {
    const h = setup();
    runCommand(h.ctx, addComponentProp, { prop: BOOL_PROP });
    const bound = runCommand(h.ctx, bindProp, {
      nodeId: "n_text0001",
      path: { field: "visible" },
      propKey: "showSub",
    });
    expect(bound.ok).toBe(true);
    expect(h.node("n_text0001").visible).toEqual({ $prop: "showSub" });

    const unbound = runCommand(h.ctx, unbindProp, { nodeId: "n_text0001", path: { field: "visible" } });
    expect(unbound.ok).toBe(true);
    expect(h.node("n_text0001").visible).toBe(true);
  });

  it("bind style fill ke $prop; unbind dengan value literal", () => {
    const h = setup();
    const colorProp: PropDef = {
      key: "brand",
      label: { id: "Warna", en: "Color" },
      type: "color",
      default: { $token: "color.primary" },
    };
    runCommand(h.ctx, addComponentProp, { prop: colorProp });
    const bound = runCommand(h.ctx, bindProp, {
      nodeId: "n_root0001",
      path: { field: "style", breakpoint: "base", group: "fills", key: "color" },
      propKey: "brand",
    });
    expect(bound.ok).toBe(true);
    expect(h.node("n_root0001").style?.base?.fills?.color).toEqual({ $prop: "brand" });

    const unbound = runCommand(h.ctx, unbindProp, {
      nodeId: "n_root0001",
      path: { field: "style", breakpoint: "base", group: "fills", key: "color" },
      value: { $token: "color.primary" },
    });
    expect(unbound.ok).toBe(true);
    expect(h.node("n_root0001").style?.base?.fills?.color).toEqual({ $token: "color.primary" });
  });

  it("removeComponentProp ditolak selama masih di-bind; sukses setelah unbind", () => {
    const h = setup();
    runCommand(h.ctx, addComponentProp, { prop: TEXT_PROP });
    runCommand(h.ctx, bindProp, { nodeId: "n_text0001", path: { field: "prop", key: "content" }, propKey: "title" });

    const blocked = runCommand(h.ctx, removeComponentProp, { key: "title" });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.code).toBe("INVALID_TARGET");

    // Unbind dengan konten literal baru, lalu hapus prop berhasil.
    runCommand(h.ctx, unbindProp, {
      nodeId: "n_text0001",
      path: { field: "prop", key: "content" },
      value: { type: "doc", content: [] },
    });
    const removed = runCommand(h.ctx, removeComponentProp, { key: "title" });
    expect(removed.ok).toBe(true);
    expect(h.read().propsSchema).toEqual([]);
  });
});

describe("repeater list (CMP-022)", () => {
  const LIST_PROP: PropDef = {
    key: "items",
    label: { id: "Item", en: "Items" },
    type: "list",
    itemSchema: [{ key: "label", label: { id: "L", en: "L" }, type: "text", default: "" }],
    default: [],
  };

  it("setRepeatProp menandai frame; prop non-list ditolak; null melepas", () => {
    const h = setup();
    runCommand(h.ctx, addComponentProp, { prop: LIST_PROP });
    const set = runCommand(h.ctx, setRepeatProp, { nodeId: "n_root0001", listKey: "items" });
    expect(set.ok).toBe(true);
    expect(h.node("n_root0001").props?.repeatProp).toBe("items");

    runCommand(h.ctx, addComponentProp, { prop: TEXT_PROP });
    const bad = runCommand(h.ctx, setRepeatProp, { nodeId: "n_root0001", listKey: "title" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("INVALID_TARGET");

    const cleared = runCommand(h.ctx, setRepeatProp, { nodeId: "n_root0001", listKey: null });
    expect(cleared.ok).toBe(true);
    expect(h.node("n_root0001").props?.repeatProp).toBeUndefined();
  });
});

describe("nodeAccess (CMP-024)", () => {
  it("setNodeAccess set/round-trip; node tak ada → NOT_FOUND; null melepas", () => {
    const h = setup();
    const set = runCommand(h.ctx, setNodeAccess, { nodeId: "n_text0001", access: { simpleAccess: "content" } });
    expect(set.ok).toBe(true);
    expect(h.read().nodeAccess?.n_text0001).toEqual({ simpleAccess: "content" });

    const missing = runCommand(h.ctx, setNodeAccess, { nodeId: "n_ghost0001", access: { hardLocked: true } });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("NOT_FOUND");

    const cleared = runCommand(h.ctx, setNodeAccess, { nodeId: "n_text0001", access: null });
    expect(cleared.ok).toBe(true);
    expect(h.read().nodeAccess).toBeUndefined();
  });
});

describe("variant axis (CMP-030)", () => {
  const AXIS = { name: "layout", options: ["row", "stack", "grid"], default: "row" };

  it("add/update/remove axis; duplikat → gagal; default bukan option → gagal", () => {
    const h = setup();
    const add = runCommand(h.ctx, addVariantAxis, AXIS);
    expect(add.ok).toBe(true);
    expect(h.read().variantAxes).toEqual([AXIS]);

    const dup = runCommand(h.ctx, addVariantAxis, AXIS);
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe("INVALID_TARGET");

    // default bukan salah satu option → ditolak schema (VariantAxisSchema.refine).
    const bad = runCommand(h.ctx, addVariantAxis, { name: "size", options: ["sm"], default: "xl" });
    expect(bad.ok).toBe(false);

    const upd = runCommand(h.ctx, updateVariantAxis, {
      name: "layout",
      axis: { ...AXIS, options: ["row", "stack", "grid", "flow"] },
    });
    expect(upd.ok).toBe(true);
    expect(h.read().variantAxes?.[0]?.options).toContain("flow");

    const rem = runCommand(h.ctx, removeVariantAxis, { name: "layout" });
    expect(rem.ok).toBe(true);
    expect(h.read().variantAxes).toBeUndefined();
  });
});
