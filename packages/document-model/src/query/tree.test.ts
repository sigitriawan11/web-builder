import { describe, expect, it } from "vitest";
import { heroDocument, nestedDocument, richTextDocument } from "../../test/fixtures/basic-documents";
import type { SiteDocument } from "../schema";
import { ancestors, descendants, findNode, findNodes, pageOf, walk } from "./tree";

// T1.9.10: query helper (ARCHITECTURE §4.2, DM-074).
describe("findNode / ancestors / pageOf", () => {
  const doc = heroDocument();

  it("findNode by id; tidak ada → undefined", () => {
    expect(findNode(doc, "n_herottl001")?.name).toBe("Hero / Title");
    expect(findNode(doc, "n_tidakada001")).toBeUndefined();
  });

  it("ancestors naik dari parent langsung sampai page", () => {
    expect(ancestors(doc, "n_herottl001").map((node) => node.id)).toEqual(["n_hero000001", "pg_home000001"]);
    expect(ancestors(doc, "pg_home000001")).toEqual([]);
    expect(ancestors(doc, "n_tidakada001")).toEqual([]);
  });

  it("pageOf: node → page-nya, page → dirinya, yatim/tidak ada → undefined", () => {
    expect(pageOf(doc, "n_herottl001")).toBe("pg_home000001");
    expect(pageOf(doc, "pg_about00001")).toBe("pg_about00001");
    expect(pageOf(doc, "n_tidakada001")).toBeUndefined();
    const orphan = heroDocument();
    const hero = orphan.nodes.n_hero000001;
    if (hero) hero.parentId = "n_hilang00001";
    expect(pageOf(orphan, "n_herottl001")).toBeUndefined();
  });

  it("siklus pada dokumen rusak tidak membuat loop tak berujung", () => {
    const broken = heroDocument() as SiteDocument;
    const hero = broken.nodes.n_hero000001;
    const title = broken.nodes.n_herottl001;
    if (hero && title) {
      hero.parentId = "n_herottl001";
      title.parentId = "n_hero000001";
    }
    expect(ancestors(broken, "n_herottl001").length).toBeLessThanOrEqual(Object.keys(broken.nodes).length + 1);
    expect(pageOf(broken, "n_herottl001")).toBeUndefined();
  });
});

describe("walk / descendants", () => {
  it("pre-order urutan DOM dengan depth & index; false melewati anak", () => {
    const doc = nestedDocument();
    const visited: string[] = [];
    walk(doc, "pg_home000001", ({ node, depth, index }) => {
      visited.push(`${depth}:${index}:${node.id}`);
    });
    const ids = visited.map((entry) => entry.split(":")[2]);
    expect(ids[0]).toBe("pg_home000001");
    // Setiap node muncul setelah parent-nya dan sebelum sibling berikutnya (pre-order).
    for (const id of ids.slice(1)) {
      const parent = doc.nodes[id as string]?.parentId as string;
      expect(ids.indexOf(parent)).toBeLessThan(ids.indexOf(id));
    }
    expect(new Set(ids).size).toBe(ids.length);

    const shallow: string[] = [];
    walk(doc, "pg_home000001", ({ node, depth }) => {
      shallow.push(node.id);
      return depth < 1;
    });
    const page = doc.nodes.pg_home000001;
    expect(shallow).toEqual(["pg_home000001", ...(page && "children" in page ? page.children : [])]);
  });

  it("descendants tanpa akar; maxDepth 1 = anak langsung; child yang hilang dilewati", () => {
    const doc = heroDocument();
    expect(descendants(doc, "n_hero000001").map((node) => node.id)).toEqual(["n_herottl001", "n_heroimg001"]);
    expect(descendants(doc, "pg_home000001", 1).map((node) => node.id)).toEqual(["n_hero000001"]);
    const hero = doc.nodes.n_hero000001;
    if (hero && "children" in hero) hero.children.push("n_hilang00001");
    expect(descendants(doc, "n_hero000001")).toHaveLength(2);
  });
});

describe("findNodes", () => {
  it("filter tipe, nama (tanpa beda huruf), teks polos, dan page", () => {
    const doc = heroDocument();
    expect(findNodes(doc, { type: "image" }).map((node) => node.id)).toEqual(["n_heroimg001"]);
    expect(findNodes(doc, { nameContains: "HERO" }).map((node) => node.id)).toEqual(
      expect.arrayContaining(["n_hero000001", "n_herottl001", "n_heroimg001"]),
    );
    expect(
      findNodes(doc, { type: "frame", pageId: "pg_about00001" }).every(
        (node) => pageOf(doc, node.id) === "pg_about00001",
      ),
    ).toBe(true);

    const rich = richTextDocument();
    expect(findNodes(rich, { text: "NASTAR" }).map((node) => node.id)).toEqual(["n_richtext001"]);
    expect(findNodes(rich, { text: "tidak ada" })).toEqual([]);
  });
});
