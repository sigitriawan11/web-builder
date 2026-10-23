import {
  type CommandContext,
  type ComponentDefinition,
  createBlankSiteDocument,
  jsonToYDoc,
  type SiteDocument,
  yDocToJson,
} from "@platform/document-model";
import { describe, expect, it } from "vitest";
import { DraftSession } from "../draft/draft-store";
import type { ToolContext } from "../tool";
import { searchComponents } from "./library";
import { insertComponent, setProp, updateNodeStyle, updateText } from "./mutation";
import type { AiToolPorts } from "./ports";
import { getNode, getPageTree } from "./read";

// T3.13.4 (AI-061/AI-102): handler tool di Y.Doc fixture lewat DraftSession (tools/** tak menyentuh Yjs langsung).

const richText = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const buttonDef: ComponentDefinition = {
  schemaVersion: 1,
  id: "cmp_testbtn01",
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

function fixture(): { session: DraftSession; ctx: ToolContext; pageId: string } {
  const base = createBlankSiteDocument({ title: "Test", language: "en" });
  const pageId = base.pageOrder[0] as string;
  const nodes = base.nodes as Record<string, unknown>;
  (nodes[pageId] as { children: string[] }).children = ["n_hero001"];
  nodes.n_hero001 = {
    id: "n_hero001",
    type: "frame",
    name: "Hero",
    parentId: pageId,
    visible: true,
    locked: false,
    tag: "div",
    children: ["n_head001"],
    style: { base: {} },
    props: {},
  };
  nodes.n_head001 = {
    id: "n_head001",
    type: "text",
    name: "Headline",
    parentId: "n_hero001",
    visible: true,
    locked: false,
    tag: "h1",
    style: { base: {} },
    props: { content: richText("Old headline") },
  };
  const main = jsonToYDoc(base as SiteDocument);
  const extra: Partial<CommandContext> = {
    getComponent: (id, version) => (id === "cmp_testbtn01" && version === 1 ? buttonDef : undefined),
  };
  const session = new DraftSession(main, "run-tools", extra);
  const ports: AiToolPorts = {
    searchComponents: async () => [
      { componentId: "cmp_testbtn01", name: "Button", version: 1, categorySlug: "elements" },
    ],
  };
  const ctx: ToolContext = {
    commandCtx: session.commandContext(),
    readDocument: () => yDocToJson(session.draft),
    mode: "user",
    runId: "run-tools",
    ports: ports as Record<string, unknown>,
  };
  return { session, ctx, pageId };
}

describe("tool dasar Read/Library/Mutation (T3.13.4)", () => {
  it("get_page_tree: outline memuat node", async () => {
    const { ctx, pageId } = fixture();
    const res = await getPageTree.run(ctx, { pageId });
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.output as { outline: string }).outline).toContain("Hero");
  });

  it("get_node: ditemukan + NOT_FOUND", async () => {
    const { ctx } = fixture();
    const ok = await getNode.run(ctx, { nodeId: "n_head001" });
    expect(ok.ok).toBe(true);
    const miss = await getNode.run(ctx, { nodeId: "n_nope001" });
    expect(miss.ok).toBe(false);
    if (!miss.ok) expect(miss.error.code).toBe("NOT_FOUND");
  });

  it("search_components: lewat port", async () => {
    const { ctx } = fixture();
    const res = await searchComponents.run(ctx, { query: "button" });
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.output as { components: unknown[] }).components).toHaveLength(1);
  });

  it("update_text: ganti isi node teks", async () => {
    const { ctx, session } = fixture();
    const res = await updateText.run(ctx, { nodeId: "n_head001", text: "New headline" });
    expect(res.ok).toBe(true);
    const json = yDocToJson(session.draft) as { nodes: Record<string, { props?: { content?: unknown } }> };
    expect(JSON.stringify(json.nodes.n_head001?.props?.content)).toContain("New headline");
  });

  it("update_node_style: patch fills", async () => {
    const { ctx } = fixture();
    const res = await updateNodeStyle.run(ctx, {
      nodeId: "n_hero001",
      patch: { fills: [{ type: "solid", color: "#ff0000" }] },
    });
    expect(res.ok).toBe(true);
  });

  it("insert_component + set_prop: instance baru + prop", async () => {
    const { ctx, session } = fixture();
    const inserted = await insertComponent.run(ctx, {
      parentId: "n_hero001",
      componentId: "cmp_testbtn01",
      version: 1,
    });
    expect(inserted.ok).toBe(true);
    const nodeId = inserted.ok ? (inserted.output as { nodeId: string }).nodeId : "";
    expect(nodeId).toMatch(/^n_/);

    const propped = await setProp.run(ctx, { instanceId: nodeId, key: "label", value: "Pesan" });
    expect(propped.ok).toBe(true);
    const json = yDocToJson(session.draft) as {
      nodes: Record<string, { props?: { propValues?: Record<string, unknown> } }>;
    };
    expect(json.nodes[nodeId]?.props?.propValues?.label).toBe("Pesan");
  });

  it("insert_component: parent tidak ada → NOT_FOUND/CONSTRAINT", async () => {
    const { ctx } = fixture();
    const res = await insertComponent.run(ctx, { parentId: "n_ghost001", componentId: "cmp_testbtn01", version: 1 });
    expect(res.ok).toBe(false);
  });
});
