import { describe, expect, it } from "vitest";
import { setupDoc } from "../../test/command-harness";
import { minimalDocument } from "../../test/fixtures/basic-documents";
import type { ComponentDefinition, InstanceProps, PropDef, SiteDocument } from "../schema";
import { ComponentNodeSchema } from "../validate/component";
import { componentDefToYDoc } from "../yjs/component-mapping";
import { yDocToJson } from "../yjs/mapping";
import { userOrigin } from "../yjs/origin";
import { type CommandContext, runCommand } from "./command";
import { createNode } from "./create-node";
import {
  createInstance,
  extractToInstance,
  resetOverride,
  setInstanceOverride,
  setProp,
  setSlotContent,
  setVariant,
  swapInstance,
  updateInstanceVersion,
} from "./instance";

function make() {
  const harness = setupDoc(minimalDocument());
  const homeId = harness.read().pageOrder[0] as string;
  const created = runCommand(harness.ctx, createInstance, {
    parentId: homeId,
    componentId: "cmp_btn0001",
    version: 1,
    propValues: { label: "Pesan" },
    variant: { tone: "primary" },
  });
  if (!created.ok) throw new Error(`createInstance gagal: ${created.error.code}`);
  return { ...harness, homeId, instId: created.value };
}

const instanceProps = (doc: SiteDocument, id: string): InstanceProps => {
  const node = doc.nodes[id];
  if (node?.type !== "instance") throw new Error("bukan instance");
  return node.props;
};

describe("command instance (DM-074)", () => {
  it("createInstance: node instance + componentDeps tercatat", () => {
    const { read, instId } = make();
    const doc = read();
    const props = instanceProps(doc, instId);
    expect(props).toMatchObject({
      componentId: "cmp_btn0001",
      version: 1,
      propValues: { label: "Pesan" },
      variant: { tone: "primary" },
    });
    expect(doc.componentDeps.cmp_btn0001).toEqual({ version: 1, source: "library" });
  });

  it("updateInstanceVersion: pin ulang versi + componentDeps (T3.6.9)", () => {
    const h = make();
    const result = runCommand(h.ctx, updateInstanceVersion, { id: h.instId, version: 2 });
    expect(result.ok).toBe(true);
    const doc = h.read();
    expect(instanceProps(doc, h.instId).version).toBe(2);
    expect(doc.componentDeps.cmp_btn0001).toEqual({ version: 2, source: "library" });
    // Target bukan instance → INVALID_TARGET.
    const bad = runCommand(h.ctx, updateInstanceVersion, { id: h.homeId, version: 2 });
    expect(bad.ok).toBe(false);
  });

  it("swapInstance: mapping by key + semanticRole, drop sisanya (T3.6.6/CMP-074)", () => {
    const h = setupDoc(minimalDocument());
    const homeId = h.read().pageOrder[0] as string;
    const created = runCommand(h.ctx, createInstance, {
      parentId: homeId,
      componentId: "cmp_from0001",
      version: 1,
      propValues: { label: "Pesan", extra: "Lama" },
      variant: { tone: "primary" },
    });
    if (!created.ok) throw new Error(`createInstance gagal: ${created.error.code}`);
    const instId = created.value;

    const rootNode = (id: string) => ({
      [id]: {
        id,
        type: "frame" as const,
        name: "Root",
        parentId: null,
        visible: true,
        locked: false,
        tag: "div",
        children: [],
        style: { base: {} },
        props: {},
      },
    });
    const text = (key: string, semanticRole?: string): PropDef =>
      ({ key, label: { id: key, en: key }, type: "text", ...(semanticRole ? { semanticRole } : {}) }) as PropDef;
    const FROM: ComponentDefinition = {
      schemaVersion: 1,
      id: "cmp_from0001",
      version: 1,
      name: "From",
      category: "card",
      propsSchema: [text("label", "heading"), text("extra")],
      variantAxes: [{ name: "tone", options: ["primary", "ghost"], default: "primary" }],
      rootId: "n_root0001",
      nodes: rootNode("n_root0001"),
    };
    const TO: ComponentDefinition = {
      schemaVersion: 1,
      id: "cmp_to0001",
      version: 1,
      name: "To",
      category: "card",
      propsSchema: [
        text("label"),
        text("headingText", "heading"),
        { key: "count", label: { id: "count", en: "count" }, type: "number" } as PropDef,
      ],
      variantAxes: [{ name: "tone", options: ["primary", "outline"], default: "primary" }],
      rootId: "n_root0001",
      nodes: rootNode("n_root0001"),
    };
    const ctx: CommandContext = {
      ...h.ctx,
      getComponent: (cid, v) =>
        cid === "cmp_from0001" && v === 1 ? FROM : cid === "cmp_to0001" && v === 1 ? TO : undefined,
    };
    const result = runCommand(ctx, swapInstance, { id: instId, toComponentId: "cmp_to0001", toVersion: 1 });
    if (!result.ok) throw new Error(`swap gagal: ${result.error.code}`);
    expect(result.value.droppedKeys).toEqual(["extra"]);
    const props = instanceProps(h.read(), instId);
    expect(props.componentId).toBe("cmp_to0001");
    expect(props.version).toBe(1);
    // `label` dibawa by key; `headingText` dibawa by semanticRole "heading"; `extra` hilang.
    expect(props.propValues).toEqual({ label: "Pesan", headingText: "Pesan" });
    expect(props.variant).toEqual({ tone: "primary" }); // "primary" valid di axis tone tujuan
    expect(h.read().componentDeps.cmp_to0001).toEqual({ version: 1, source: "library" });

    // Tanpa registry → INVALID_TARGET.
    const noReg = runCommand(h.ctx, swapInstance, { id: instId, toComponentId: "cmp_to0001", toVersion: 1 });
    expect(noReg.ok).toBe(false);
  });

  it("setProp menetapkan & menghapus nilai", () => {
    const { ctx, read, instId } = make();
    expect(runCommand(ctx, setProp, { id: instId, key: "label", value: "Beli" }).ok).toBe(true);
    expect(instanceProps(read(), instId).propValues?.label).toBe("Beli");
    expect(runCommand(ctx, setProp, { id: instId, key: "label", value: undefined }).ok).toBe(true);
    expect(instanceProps(read(), instId).propValues?.label).toBeUndefined();
  });

  it("setVariant menetapkan axis", () => {
    const { ctx, read, instId } = make();
    expect(runCommand(ctx, setVariant, { id: instId, axis: "size", option: "lg" }).ok).toBe(true);
    expect(instanceProps(read(), instId).variant).toMatchObject({ tone: "primary", size: "lg" });
  });

  it("setInstanceOverride lalu resetOverride (field & seluruh path)", () => {
    const { ctx, read, instId } = make();
    expect(
      runCommand(ctx, setInstanceOverride, {
        id: instId,
        path: "n_btnroot01",
        patch: { visible: false, style: { base: { opacity: 0.5 } } },
      }).ok,
    ).toBe(true);
    expect(instanceProps(read(), instId).overrides?.n_btnroot01).toMatchObject({ visible: false });
    // Reset satu field.
    expect(runCommand(ctx, resetOverride, { id: instId, path: "n_btnroot01", field: "visible" }).ok).toBe(true);
    expect(instanceProps(read(), instId).overrides?.n_btnroot01).not.toHaveProperty("visible");
    // Reset seluruh path.
    expect(runCommand(ctx, resetOverride, { id: instId, path: "n_btnroot01" }).ok).toBe(true);
    expect(instanceProps(read(), instId).overrides?.n_btnroot01).toBeUndefined();
  });

  it("setSlotContent: node wajib ada", () => {
    const { ctx, read, instId, homeId } = make();
    const child = runCommand(ctx, createNode, { parentId: homeId, type: "frame" });
    const childId = child.ok ? child.value : "";
    expect(runCommand(ctx, setSlotContent, { id: instId, slotName: "body", nodeIds: [childId] }).ok).toBe(true);
    expect(instanceProps(read(), instId).slots?.body).toEqual([childId]);
    expect(runCommand(ctx, setSlotContent, { id: instId, slotName: "body", nodeIds: ["n_tidakada01"] })).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
  });

  it("target bukan instance → INVALID_TARGET", () => {
    const { ctx, homeId } = make();
    expect(runCommand(ctx, setProp, { id: homeId, key: "x", value: "y" })).toMatchObject({
      error: { code: "INVALID_TARGET" },
    });
  });
});

describe("extractToInstance (CMP-011)", () => {
  // `extractToInstance` dipakai di dokumen ComponentDefinition (instance draft version 0, tanpa componentDeps) →
  // divalidasi lewat yDocToJson mentah, bukan SiteDocumentSchema (yang mewajibkan instance situs = published + dep).
  type DocJson = { nodes: Record<string, { type: string; props?: unknown; children?: string[] }> };
  function docWithFrame() {
    const harness = setupDoc(minimalDocument());
    const homeId = harness.read().pageOrder[0] as string;
    const frame = runCommand(harness.ctx, createNode, { parentId: homeId, type: "frame", name: "Card" });
    if (!frame.ok) throw new Error(frame.error.code);
    const text = runCommand(harness.ctx, createNode, { parentId: frame.value, type: "text", name: "Title" });
    if (!text.ok) throw new Error(text.error.code);
    return {
      ...harness,
      homeId,
      frameId: frame.value,
      textId: text.value,
      json: () => yDocToJson(harness.doc) as DocJson,
    };
  }

  it("ganti subtree dgn instance (version 0 draft) di posisi sama; subtree lama terhapus; satu langkah undo", () => {
    const h = docWithFrame();
    const before = h.json();
    const result = runCommand(h.ctx, extractToInstance, {
      rootId: h.frameId,
      componentId: "cmp_newcard01",
      version: 0,
    });
    if (!result.ok) throw new Error(result.error.code);

    const after = h.json();
    // Frame + text lama hilang; instance baru ada di posisi frame (child home).
    expect(after.nodes[h.frameId]).toBeUndefined();
    expect(after.nodes[h.textId]).toBeUndefined();
    const instId = result.value.instanceId;
    expect(after.nodes[h.homeId]?.children).toContain(instId);
    const inst = after.nodes[instId];
    expect(inst?.type).toBe("instance");
    const props = inst?.props as InstanceProps | undefined;
    expect(props?.componentId).toBe("cmp_newcard01");
    expect(props?.version).toBe(0);

    // Satu langkah undo → kembali persis seperti sebelum extract.
    h.undoManager.undo();
    expect(h.json()).toEqual(before);
  });

  it("root dokumen (page, tanpa parent) tidak bisa diekstrak", () => {
    const h = docWithFrame();
    const result = runCommand(h.ctx, extractToInstance, { rootId: h.homeId, componentId: "cmp_x0000001", version: 0 });
    expect(result.ok).toBe(false);
  });

  // Mode Admin: extract di dokumen ComponentDefinition — parent node yang diekstrak = ROOT component (`parentId: null`).
  // Pasca-cek command harus pakai `ComponentNodeSchema`; schema node situs menolak frame root tanpa parent.
  describe("di dokumen ComponentDefinition (root parentId null)", () => {
    const DEF: ComponentDefinition = {
      schemaVersion: 1,
      id: "cmp_srccard1",
      version: 1,
      name: "SrcCard",
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

    function componentCtx(): { ctx: CommandContext; json: () => DocJson } {
      const doc = componentDefToYDoc(DEF);
      const ctx: CommandContext = { doc, origin: userOrigin("test"), nodeSchema: ComponentNodeSchema };
      return { ctx, json: () => yDocToJson(doc) as DocJson };
    }

    it("ganti anak-root dengan instance; root (parentId null) tidak dianggap tidak valid", () => {
      const { ctx, json } = componentCtx();
      const result = runCommand(ctx, extractToInstance, {
        rootId: "n_text0001",
        componentId: "cmp_newtext1",
        version: 0,
      });
      if (!result.ok) throw new Error(result.error.code);
      const after = json();
      expect(after.nodes.n_text0001).toBeUndefined();
      const instId = result.value.instanceId;
      expect(after.nodes.n_root0001?.children).toContain(instId);
      expect(after.nodes[instId]?.type).toBe("instance");
    });

    it("tanpa ComponentNodeSchema (default schema situs) → root parentId null ditolak (INVARIANT_VIOLATION)", () => {
      const doc = componentDefToYDoc(DEF);
      const ctx: CommandContext = { doc, origin: userOrigin("test") }; // default = NodeSchema situs
      const result = runCommand(ctx, extractToInstance, {
        rootId: "n_text0001",
        componentId: "cmp_newtext1",
        version: 0,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INVARIANT_VIOLATION");
    });
  });
});
