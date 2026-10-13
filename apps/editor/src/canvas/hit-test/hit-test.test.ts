// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { hitTestNode, isSelectablePath } from "./hit-test";

// DOM nyata (jsdom) untuk struktur & closest; elementsFromPoint diganti tumpukan buatan karena jsdom tanpa layout.
function setup(locked: string[] = []) {
  document.body.innerHTML = `
    <main data-node-id="pg_home000001">
      <section data-node-id="n_hero000001">
        <h1 data-node-id="n_title00001"><strong>Kue</strong> rumahan</h1>
        <div data-node-id="n_card000001"><img data-node-id="n_photo00001" /></div>
      </section>
    </main>`;
  const byId = (id: string) => document.querySelector(`[data-node-id="${id}"]`) as Element;
  const lockedSet = new Set(locked);
  const isSelectable = (path: readonly string[]) => isSelectablePath(path, (id) => lockedSet.has(id));
  // Tumpukan dari atas ke bawah, seperti elementsFromPoint browser.
  const at = (...stack: Element[]) => ({ elementsFromPoint: () => stack }) as unknown as DocumentOrShadowRoot;
  return { byId, isSelectable, at };
}

describe("hitTestNode (ED-020)", () => {
  it("memilih node teratas beserta rantai ancestor-nya", () => {
    const { byId, isSelectable, at } = setup();
    const stack = at(byId("n_photo00001"), byId("n_card000001"), byId("n_hero000001"), byId("pg_home000001"));

    expect(hitTestNode(stack, 0, 0, isSelectable)).toEqual({
      nodeId: "n_photo00001",
      path: ["n_photo00001", "n_card000001", "n_hero000001", "pg_home000001"],
    });
  });

  it("elemen non-node di dalam node (mark rich text) dipetakan ke node pemiliknya", () => {
    const { byId, isSelectable, at } = setup();
    const strong = byId("n_title00001").querySelector("strong") as Element;

    expect(hitTestNode(at(strong, byId("n_title00001")), 0, 0, isSelectable)?.nodeId).toBe("n_title00001");
  });

  it("node terkunci dilewati: klik tembus ke node di bawahnya", () => {
    const { byId, isSelectable, at } = setup(["n_photo00001"]);
    const stack = at(byId("n_photo00001"), byId("n_card000001"), byId("n_hero000001"));

    expect(hitTestNode(stack, 0, 0, isSelectable)?.nodeId).toBe("n_card000001");
  });

  it("turunan node terkunci ikut tidak bisa dipilih", () => {
    const { byId, isSelectable, at } = setup(["n_card000001"]);
    const stack = at(byId("n_photo00001"), byId("n_card000001"), byId("n_hero000001"), byId("pg_home000001"));

    expect(hitTestNode(stack, 0, 0, isSelectable)?.nodeId).toBe("n_hero000001");
  });

  it("titik tanpa node (chrome editor, area kosong) mengembalikan null", () => {
    const { isSelectable, at } = setup();
    const outside = document.createElement("div");

    expect(hitTestNode(at(outside, document.body), 0, 0, isSelectable)).toBeNull();
    expect(hitTestNode(at(), 0, 0, isSelectable)).toBeNull();
  });

  it("semua kandidat terkunci → null", () => {
    const { byId, isSelectable, at } = setup(["pg_home000001"]);

    expect(hitTestNode(at(byId("n_title00001"), byId("pg_home000001")), 0, 0, isSelectable)).toBeNull();
  });
});

describe("hitTestNode — atribut kosong", () => {
  it("elemen dengan data-node-id kosong tidak masuk path", () => {
    document.body.innerHTML = `<main data-node-id="pg_home000001"><div data-node-id=""><p data-node-id="n_text000001">x</p></div></main>`;
    const text = document.querySelector('[data-node-id="n_text000001"]') as Element;
    const root = { elementsFromPoint: () => [text] } as unknown as DocumentOrShadowRoot;

    expect(hitTestNode(root, 0, 0, () => true)?.path).toEqual(["n_text000001", "pg_home000001"]);
  });
});
