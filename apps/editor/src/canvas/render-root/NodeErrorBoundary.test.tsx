// @vitest-environment jsdom
import { jsonToYDoc, runCommand, updateStyle } from "@platform/document-model";
import { landing200 } from "@platform/document-model/fixtures";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as Y from "yjs";
import { PanelErrorBoundary } from "../../app/PanelErrorBoundary";
import { NodeStore } from "../../document/node-store";
import { NodeStoreContext } from "../../document/use-node";
import { DESKTOP_FRAME, FrameContext } from "./breakpoint-context";
import { NodeErrorActionsContext, NodeErrorBoundary } from "./NodeErrorBoundary";
import { NodeView, ThemeContext } from "./NodeView";
import { createEditorRenderEnv, RenderEnvContext } from "./render-env";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.restoreAllMocks();
});

function mountInto(element: React.ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(element));
  cleanups.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  return container;
}

function mountCanvas(actions: Parameters<typeof NodeErrorActionsContext.Provider>[0]["value"] = null) {
  const fixture = landing200();
  const doc = jsonToYDoc(fixture);
  const store = new NodeStore(doc);
  cleanups.push(() => store.destroy());
  const pageId = fixture.pageOrder[0] ?? "";
  const container = mountInto(
    <NodeStoreContext.Provider value={store}>
      <NodeErrorActionsContext.Provider value={actions}>
        <FrameContext.Provider value={DESKTOP_FRAME}>
          <ThemeContext.Provider value={fixture.theme}>
            <RenderEnvContext.Provider
              value={createEditorRenderEnv({
                pageId,
                breakpoint: "base",
                node: (id) => store.getNode(id) ?? undefined,
                asset: (id) => fixture.assets[id],
              })}
            >
              <NodeView id={pageId} parent="block" />
            </RenderEnvContext.Provider>
          </ThemeContext.Provider>
        </FrameContext.Provider>
      </NodeErrorActionsContext.Provider>
    </NodeStoreContext.Provider>,
  );
  const card = Object.values(fixture.nodes).find((node) => node.type === "frame" && node.props.role === "card");
  if (!card) throw new Error("fixture tanpa kartu");
  return { doc, store, container, card, total: Object.keys(fixture.nodes).length };
}

// Hanya test: menyuntik data rusak langsung ke Y.Doc (mensimulasikan update remote invalid) — produk memakai command.
function corrupt(doc: Y.Doc, id: string) {
  doc.transact(() => (doc.getMap("nodes").get(id) as Y.Map<unknown>).set("visible", "bukan-boolean"), "remote");
}

describe("ED-228 — node rusak tidak menjatuhkan canvas", () => {
  it("AC: node dengan data invalid → placeholder; node lain tetap dirender (bukan blank screen)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { doc, container, card } = mountCanvas();
    const before = container.querySelectorAll("[data-node-id]").length;
    act(() => corrupt(doc, card.id));

    const placeholder = container.querySelector(`[data-node-id="${card.id}"]`);
    expect(placeholder?.hasAttribute("data-node-error")).toBe(true);
    expect(placeholder?.textContent).toContain("Elemen tidak bisa ditampilkan");
    // Subtree kartu diganti satu placeholder; sisa page tetap ada.
    const after = container.querySelectorAll("[data-node-id]").length;
    expect(after).toBeGreaterThan(before / 2);
    expect(container.querySelector(`[data-node-id="${card.parentId}"]`)).not.toBeNull();
  });

  it("placeholder: Hapus & Laporkan memanggil aksi canvas", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const actions = { deleteNode: vi.fn(), reportNode: vi.fn() };
    const { doc, container, card } = mountCanvas(actions);
    act(() => corrupt(doc, card.id));
    const buttons = [...container.querySelectorAll<HTMLButtonElement>(`[data-node-id="${card.id}"] button`)];
    expect(buttons.map((button) => button.textContent)).toEqual(["Hapus", "Laporkan"]);
    act(() => buttons[0]?.click());
    expect(actions.deleteNode).toHaveBeenCalledWith(card.id);
    act(() => buttons[1]?.click());
    expect(actions.reportNode).toHaveBeenCalledWith(card.id, expect.any(Error));
    expect(container.textContent).toContain("Terima kasih, sudah dilaporkan");
  });

  it("error render satu node → boundary node itu saja; dicoba lagi saat node berubah", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { doc, store, card } = mountCanvas();
    let shouldThrow = true;
    function Fragile() {
      if (shouldThrow) throw new Error("render gagal");
      return <span data-testid="pulih">ok</span>;
    }
    const container = mountInto(
      <NodeStoreContext.Provider value={store}>
        <div data-testid="saudara">tetap ada</div>
        <NodeErrorBoundary id={card.id}>
          <Fragile />
        </NodeErrorBoundary>
      </NodeStoreContext.Provider>,
    );
    expect(container.querySelector("[data-node-error]")).not.toBeNull();
    expect(container.textContent).toContain("tetap ada");

    shouldThrow = false;
    act(() => {
      const result = runCommand({ doc, origin: { kind: "user", sessionId: "t" } }, updateStyle, {
        ids: [card.id],
        patch: { fills: [{ type: "solid", color: "#FF0000" }] },
      });
      expect(result.ok).toBe(true);
    });
    expect(container.querySelector("[data-node-error]")).toBeNull();
    expect(container.textContent).toContain("ok");
  });
});

describe("PanelErrorBoundary (ED-228)", () => {
  it("panel gagal → pesan + Muat ulang panel me-mount ulang isinya", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let fail = true;
    function Panel() {
      if (fail) throw new Error("panel rusak");
      return <p>isi panel</p>;
    }
    const container = mountInto(
      <PanelErrorBoundary name="layers">
        <Panel />
      </PanelErrorBoundary>,
    );
    expect(container.textContent).toContain("Panel ini mengalami masalah");
    fail = false;
    act(() => container.querySelector("button")?.click());
    expect(container.textContent).toBe("isi panel");
  });
});
