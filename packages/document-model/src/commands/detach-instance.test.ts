import { describe, expect, it } from "vitest";
import { setupDoc } from "../../test/command-harness";
import { minimalDocument } from "../../test/fixtures/basic-documents";
import type { ComponentDefinition, SiteDocument } from "../schema";
import { validateDocument } from "../validate/validate-document";
import { runCommand } from "./command";
import { createInstance, detachInstance } from "./instance";

const label = { id: "L", en: "L" };
const buttonDef = {
  schemaVersion: 1,
  id: "cmp_btn0001",
  version: 1,
  name: "Button",
  category: "button",
  propsSchema: [{ key: "label", label, type: "text", default: "Klik" }],
  variantAxes: [{ name: "tone", options: ["primary", "ghost"], default: "primary" }],
  variants: [{ when: { tone: "ghost" }, overrides: { n_btnroot01: { style: { base: { opacity: 0.5 } } } } }],
  rootId: "n_btnroot01",
  nodes: {
    n_btnroot01: {
      id: "n_btnroot01",
      type: "frame",
      name: "Button",
      parentId: null,
      visible: true,
      locked: false,
      tag: "div",
      children: ["n_btnlabel1"],
      style: { base: {} },
      props: { role: "button" },
    },
    n_btnlabel1: {
      id: "n_btnlabel1",
      type: "text",
      name: "Label",
      parentId: "n_btnroot01",
      visible: true,
      locked: false,
      tag: "span",
      style: { base: {} },
      props: { content: { $prop: "label" } },
    },
  },
} as unknown as ComponentDefinition;

const registry = new Map([["cmp_btn0001@1", buttonDef]]);

function setup() {
  const harness = setupDoc(minimalDocument());
  const ctx = { ...harness.ctx, getComponent: (id: string, v: number) => registry.get(`${id}@${v}`) };
  const homeId = harness.read().pageOrder[0] as string;
  const created = runCommand(ctx, createInstance, {
    parentId: homeId,
    componentId: "cmp_btn0001",
    version: 1,
    propValues: { label: "Beli" },
    variant: { tone: "ghost" },
  });
  if (!created.ok) throw new Error("createInstance gagal");
  return { ...harness, ctx, homeId, instId: created.value };
}

const textContent = (node: SiteDocument["nodes"][string] | undefined): string | undefined => {
  if (node?.type !== "text") return undefined;
  const c = node.props.content as { content?: { content?: { text?: string }[] }[] };
  return c.content?.[0]?.content?.[0]?.text;
};

describe("detachInstance (DM-050)", () => {
  it("instance → node biasa ($prop & variant diterapkan); metadata.detachedFrom; dokumen valid", () => {
    const { ctx, read, instId, homeId } = setup();
    const result = runCommand(ctx, detachInstance, { id: instId });
    expect(result.ok).toBe(true);
    const doc = read();
    // Instance hilang.
    expect(doc.nodes[instId]).toBeUndefined();
    // Root detach = frame role button, anak home.
    const home = doc.nodes[homeId];
    const rootId = home && "children" in home ? home.children[0] : "";
    const root = doc.nodes[rootId as string];
    expect(root?.type).toBe("frame");
    expect(root && "props" in root ? (root.props as { role?: string }).role : undefined).toBe("button");
    expect(root?.metadata?.detachedFrom).toEqual({ componentId: "cmp_btn0001", version: 1 });
    // variant ghost → opacity 0.5 di root.
    expect((root?.style.base as { opacity?: number } | undefined)?.opacity).toBe(0.5);
    // $prop label → teks "Beli".
    const labelId = root && "children" in root ? (root.children[0] as string) : "";
    expect(textContent(doc.nodes[labelId])).toBe("Beli");
    // Dokumen tetap valid.
    expect(validateDocument(doc, { mode: "publish" }).ok).toBe(true);
  });

  it("gagal tanpa registry (getComponent) atau pada non-instance", () => {
    const harness = setupDoc(minimalDocument());
    const homeId = harness.read().pageOrder[0] as string;
    const withReg = { ...harness.ctx, getComponent: (id: string, v: number) => registry.get(`${id}@${v}`) };
    const created = runCommand(withReg, createInstance, { parentId: homeId, componentId: "cmp_btn0001", version: 1 });
    const instId = created.ok ? created.value : "";
    // Tanpa getComponent di ctx.
    expect(runCommand(harness.ctx, detachInstance, { id: instId })).toMatchObject({
      error: { code: "INVALID_TARGET" },
    });
    // Target bukan instance.
    expect(runCommand(withReg, detachInstance, { id: homeId })).toMatchObject({ error: { code: "INVALID_TARGET" } });
  });
});
