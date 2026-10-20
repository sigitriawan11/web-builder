import { describe, expect, it } from "vitest";
import { setupDoc } from "../../test/command-harness";
import { minimalDocument } from "../../test/fixtures/basic-documents";
import type { InstanceProps, SiteDocument } from "../schema";
import { yDocToJson } from "../yjs/mapping";
import { runCommand } from "./command";
import { createNode } from "./create-node";
import {
  createInstance,
  extractToInstance,
  resetOverride,
  setInstanceOverride,
  setProp,
  setSlotContent,
  setVariant,
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
    expect((inst?.props as InstanceProps).componentId).toBe("cmp_newcard01");
    expect((inst?.props as InstanceProps).version).toBe(0);

    // Satu langkah undo → kembali persis seperti sebelum extract.
    h.undoManager.undo();
    expect(h.json()).toEqual(before);
  });

  it("root dokumen (page, tanpa parent) tidak bisa diekstrak", () => {
    const h = docWithFrame();
    const result = runCommand(h.ctx, extractToInstance, { rootId: h.homeId, componentId: "cmp_x0000001", version: 0 });
    expect(result.ok).toBe(false);
  });
});
