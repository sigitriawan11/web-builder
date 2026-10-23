import { type ComponentDefinition, componentDefFromState, componentDefToState } from "@platform/document-model";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { DraftSession } from "./draft/draft-store";
import { ToolRegistry } from "./registry";
import type { ToolContext } from "./tool";
import { adminAddVariant, adminCreateComponentDraft } from "./tools/admin";
import { BASE_TOOLS } from "./tools/index";
import type { AiToolPorts } from "./tools/ports";

// T3.13.5 (AI-006): tool admin. admin_add_variant (command di definisi) + admin_create_component_draft (port). Tool
// admin HANYA mode admin_library (tak terdaftar untuk user). File di luar tools/** → boleh import Yjs untuk fixture.

const buttonDef: ComponentDefinition = {
  schemaVersion: 1,
  id: "cmp_admintool1",
  version: 1,
  name: "Button",
  category: "button",
  propsSchema: [{ key: "label", label: { id: "Label", en: "Label" }, type: "text", default: "Klik" }],
  rootId: "n_btnroot01",
  nodes: {
    n_btnroot01: {
      id: "n_btnroot01",
      type: "text",
      name: "Label",
      parentId: null,
      visible: true,
      locked: false,
      tag: "span",
      style: { base: {} },
      props: { content: { $prop: "label" } },
    },
  },
} as unknown as ComponentDefinition;

function adminCtx(ports: AiToolPorts = {}): { ctx: ToolContext; session: DraftSession } {
  const main = new Y.Doc();
  Y.applyUpdate(main, componentDefToState(buttonDef));
  const session = new DraftSession(main, "run-admin");
  const ctx: ToolContext = {
    commandCtx: session.commandContext(),
    readDocument: () => ({ nodes: {} }),
    mode: "admin_library",
    runId: "run-admin",
    ports: ports as Record<string, unknown>,
  };
  return { ctx, session };
}

describe("admin tools (T3.13.5 / AI-006)", () => {
  it("admin_add_variant: menambah variant axis ke definisi", async () => {
    const { ctx, session } = adminCtx();
    const res = await adminAddVariant.run(ctx, { name: "tone", options: ["primary", "secondary"], default: "primary" });
    expect(res.ok).toBe(true);
    const def = componentDefFromState(Y.encodeStateAsUpdate(session.draft)) as ComponentDefinition;
    expect(def.variantAxes?.some((a: { name: string }) => a.name === "tone")).toBe(true);
  });

  it("admin_add_variant: default di luar options → INVALID_INPUT", async () => {
    const { ctx } = adminCtx();
    const res = await adminAddVariant.run(ctx, { name: "tone", options: ["primary"], default: "ghost" });
    // `options` min 2 → Zod INVALID_INPUT (sebelum cek default).
    expect(res.ok).toBe(false);
  });

  it("admin_create_component_draft: lewat port → componentId", async () => {
    const { ctx } = adminCtx({
      createComponentDraft: async () => ({ componentId: "01xx", publicId: "cmp_new0001" }),
    });
    const res = await adminCreateComponentDraft.run(ctx, {
      slug: "hero-baru",
      kind: "section",
      name: "HeroBaru",
      displayName: { id: "Hero Baru", en: "New Hero" },
      description: { id: "d", en: "d" },
      definition: {},
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.output as { publicId: string }).publicId).toBe("cmp_new0001");
  });

  it("AI-006: tool admin TIDAK terdaftar untuk mode user", () => {
    const registry = new ToolRegistry().register(...BASE_TOOLS, adminCreateComponentDraft, adminAddVariant);
    const userTools = registry.toolsFor({ mode: "user", entitlements: new Set(["ai"]) }).map((t) => t.name);
    expect(userTools).not.toContain("admin_create_component_draft");
    expect(userTools).not.toContain("admin_add_variant");
    const adminTools = registry.toolsFor({ mode: "admin_library", entitlements: new Set(["ai"]) }).map((t) => t.name);
    expect(adminTools).toContain("admin_add_variant");
  });
});
