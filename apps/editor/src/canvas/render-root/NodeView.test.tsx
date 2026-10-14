// @vitest-environment jsdom
import {
  createNode,
  deleteNodes,
  jsonToYDoc,
  moveNode,
  runCommand,
  type SiteDocument,
  SiteDocumentSchema,
  updateStyle,
  yDocToJson,
} from "@platform/document-model";
import { landing200 } from "@platform/document-model/fixtures";
import { act, Profiler } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { NodeStore } from "../../document/node-store";
import { NodeStoreContext } from "../../document/use-node";
import { RenderRoot, RenderScope } from "./RenderRoot";
import { renderNode } from "./render-node";
import { renderProbe } from "./render-probe";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  renderProbe.onNodeRender = null;
});

function mount(fixture: SiteDocument) {
  const doc = jsonToYDoc(fixture);
  const store = new NodeStore(doc);
  const container = document.createElement("div");
  document.body.append(container);
  const pageId = fixture.pageOrder[0] ?? "";

  const renders: string[] = [];
  let commits = 0;
  renderProbe.onNodeRender = (id) => renders.push(id);

  const root: Root = createRoot(container);
  act(() => {
    root.render(
      <Profiler id="canvas" onRender={() => commits++}>
        <NodeStoreContext.Provider value={store}>
          <RenderRoot pageId={pageId} />
        </NodeStoreContext.Provider>
      </Profiler>,
    );
  });
  cleanups.push(() => {
    act(() => root.unmount());
    store.destroy();
    container.remove();
  });

  return {
    container,
    initialRenders: [...renders],
    // Jalankan op dan kembalikan node yang render ulang + jumlah commit React.
    run(op: Parameters<typeof runCommand>[1], input: unknown) {
      renders.length = 0;
      commits = 0;
      let result: ReturnType<typeof runCommand> | undefined;
      act(() => {
        result = runCommand({ doc, origin: { kind: "user", sessionId: "test" } }, op, input);
      });
      if (!result?.ok) throw new Error(`op gagal: ${JSON.stringify(result)}`);
      return { value: result.value, renders: [...renders].sort(), commits };
    },
    json: () => SiteDocumentSchema.parse(yDocToJson(doc)),
  };
}

const element = (container: HTMLElement, id: string) => container.querySelector<HTMLElement>(`[data-node-id="${id}"]`);

// Struktur DOM (tag + id node, urut dokumen) untuk membandingkan render live vs statis.
function structureOf(root: ParentNode): string[] {
  return [...root.querySelectorAll("[data-node-id]")].map((el) => `${el.tagName}#${el.getAttribute("data-node-id")}`);
}

function descendantsOf(doc: SiteDocument, id: string): string[] {
  const node = doc.nodes[id];
  return node && "children" in node
    ? node.children.flatMap((childId) => [childId, ...descendantsOf(doc, childId)])
    : [];
}

function firstCard(doc: SiteDocument) {
  const card = Object.values(doc.nodes).find((node) => node.type === "frame" && node.props.role === "card");
  if (card?.type !== "frame") throw new Error("fixture tanpa kartu");
  return card;
}

describe("NodeView — rendering inkremental (ED-018, T0.4.2)", () => {
  it("render awal merender setiap node tepat sekali", () => {
    const fixture = landing200();
    const { initialRenders } = mount(fixture);

    expect(initialRenders).toHaveLength(200);
    expect(new Set(initialRenders).size).toBe(200);
  });

  it("mengubah style satu node hanya me-render node itu (≤ 2 komponen)", () => {
    const fixture = landing200();
    const card = firstCard(fixture);
    const editor = mount(fixture);

    const { renders, commits } = editor.run(updateStyle, {
      ids: [card.id],
      patch: { fills: [{ type: "solid", color: "#FF0000" }] },
    });

    expect(renders).toEqual([card.id]);
    expect(commits).toBe(1);
    expect(element(editor.container, card.id)?.style.backgroundColor).toBe("rgb(255, 0, 0)");
  });

  it("perubahan beberapa node dalam satu transaksi = satu commit React", () => {
    const fixture = landing200();
    const card = firstCard(fixture);
    const editor = mount(fixture);

    const { renders, commits } = editor.run(updateStyle, {
      ids: [card.id, card.parentId],
      patch: { radius: { value: 0, unit: "px" } },
    });

    expect(renders).toEqual([card.id, card.parentId].sort());
    expect(commits).toBe(1);
  });

  it("reorder di parent yang sama hanya me-render parent", () => {
    const fixture = landing200();
    const card = firstCard(fixture);
    const editor = mount(fixture);

    const { renders } = editor.run(moveNode, { id: card.id, newParentId: card.parentId, index: 99 });

    expect(renders).toEqual([card.parentId]);
    expect(element(editor.container, card.parentId)?.lastElementChild?.getAttribute("data-node-id")).toBe(card.id);
  });

  it("pindah parent me-render parent lama, parent baru, dan subtree yang dipindah saja", () => {
    const fixture = landing200();
    const card = firstCard(fixture);
    const pageId = fixture.pageOrder[0] ?? "";
    const editor = mount(fixture);

    const { renders } = editor.run(moveNode, { id: card.id, newParentId: pageId, index: 0 });

    // React me-mount ulang subtree yang pindah parent (key sama di parent berbeda = elemen baru).
    expect(renders).toEqual([card.parentId, pageId, card.id, ...descendantsOf(fixture, card.id)].sort());
    expect(element(editor.container, pageId)?.firstElementChild?.getAttribute("data-node-id")).toBe(card.id);
  });

  it("membuat node me-render parent dan node baru; menghapus hanya me-render parent", () => {
    const fixture = landing200();
    const card = firstCard(fixture);
    const editor = mount(fixture);

    const created = editor.run(createNode, { parentId: card.id, type: "frame" });
    expect(created.renders).toEqual([card.id, created.value].sort());
    expect(element(editor.container, String(created.value))).not.toBeNull();

    const removed = editor.run(deleteNodes, { ids: [card.id] });
    expect(removed.renders).toEqual([card.parentId]);
    expect(element(editor.container, card.id)).toBeNull();
  });

  it("DOM live selalu sama strukturnya dengan render statis dari JSON dokumen", () => {
    const fixture = landing200();
    const card = firstCard(fixture);
    const editor = mount(fixture);
    editor.run(moveNode, { id: card.id, newParentId: fixture.pageOrder[0] ?? "", index: 1 });
    editor.run(createNode, { parentId: card.parentId, index: 0, type: "text" });

    const doc = editor.json();
    const staticDom = document.createElement("div");
    staticDom.innerHTML = renderToStaticString(doc);

    expect(structureOf(editor.container)).toEqual(structureOf(staticDom));
  });
});

function renderToStaticString(doc: SiteDocument): string {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<RenderScope>{renderNode(doc, doc.pageOrder[0] ?? "")}</RenderScope>));
  const html = container.innerHTML;
  act(() => root.unmount());
  return html;
}
