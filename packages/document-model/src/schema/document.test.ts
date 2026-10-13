import { describe, expect, it } from "vitest";
import {
  autolayoutDocument,
  freeformDocument,
  heroDocument,
  minimalDocument,
  wrapGridDocument,
} from "../../test/fixtures/basic-documents";
import { SiteDocumentSchema } from "./document";

type Path = (string | number)[];
const REMOVE = Symbol("remove");

// Salin fixture hero lalu ubah satu path; hasilnya `unknown` karena memang sengaja tidak valid.
function heroWith(path: Path, value: unknown): unknown {
  const doc: unknown = JSON.parse(JSON.stringify(heroDocument()));
  const parentPath = path.slice(0, -1);
  const lastKey = path.at(-1);
  if (lastKey === undefined) throw new Error("path kosong");

  let target = doc as Record<string | number, unknown>;
  for (const key of parentPath) {
    target = target[key] as Record<string | number, unknown>;
  }
  if (value === REMOVE) {
    delete target[lastKey];
  } else {
    target[lastKey] = value;
  }
  return doc;
}

function issuePaths(input: unknown): string[] {
  const result = SiteDocumentSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
}

function expectIssueAt(input: unknown, expectedPath: string) {
  const paths = issuePaths(input);
  expect(paths.length, "dokumen seharusnya tidak valid").toBeGreaterThan(0);
  expect(
    paths.some((path) => path.startsWith(expectedPath)),
    `issue di: ${paths.join(", ")}`,
  ).toBe(true);
}

describe("SiteDocumentSchema — fixture valid", () => {
  it("menerima dokumen minimal 1 page tanpa child (DM-004)", () => {
    expect(issuePaths(minimalDocument())).toEqual([]);
  });

  it("menerima fixture tiga kombinasi auto-layout (DM-026, DM-027)", () => {
    expect(issuePaths(autolayoutDocument())).toEqual([]);
  });

  it("menerima grid wrap 100 kartu (T0.6.6): page + grid + 100 kartu + 100 teks", () => {
    const doc = wrapGridDocument(100);
    expect(issuePaths(doc)).toEqual([]);
    expect(Object.keys(doc.nodes)).toHaveLength(202);
  });

  it("menerima papan freeform dengan node absolute (DM-028)", () => {
    expect(issuePaths(freeformDocument())).toEqual([]);
  });

  it("menerima landing hero dengan override mobile dan null di patch (DM-036)", () => {
    const doc = heroDocument();
    const parsed = SiteDocumentSchema.parse(doc);

    expect(parsed).toEqual(doc);
  });
});

describe("SiteDocumentSchema — validasi struktur", () => {
  const cases: { name: string; path: Path; value: unknown; issueAt: string }[] = [
    { name: "key top-level tak dikenal (DM-004 strict)", path: ["customCss"], value: "x", issueAt: "" },
    { name: "schemaVersion bukan int positif", path: ["schemaVersion"], value: 0, issueAt: "schemaVersion" },
    { name: "pageOrder kosong", path: ["pageOrder"], value: [], issueAt: "pageOrder" },
    {
      name: "key style tak dikenal (DM-034)",
      path: ["nodes", "n_hero000001", "style", "base", "customCss"],
      value: "color: red",
      issueAt: "nodes.n_hero000001.style.base",
    },
    {
      name: "warna literal non-hex (DM-025)",
      path: ["nodes", "n_hero000001", "style", "base", "fills", 0, "color"],
      value: "rgb(255, 0, 0)",
      issueAt: "nodes.n_hero000001.style.base.fills.0.color",
    },
    {
      name: "panjang tanpa unit (DM-025)",
      path: ["nodes", "n_hero000001", "style", "base", "layout", "gap"],
      value: 16,
      issueAt: "nodes.n_hero000001.style.base.layout.gap",
    },
    {
      name: "format token salah (DM-025)",
      path: ["nodes", "n_hero000001", "style", "base", "layout", "gap"],
      value: { $token: "Space" },
      issueAt: "nodes.n_hero000001.style.base.layout.gap",
    },
    {
      name: "null di base (hanya boleh di patch, DM-036)",
      path: ["nodes", "n_hero000001", "style", "base", "radius"],
      value: null,
      issueAt: "nodes.n_hero000001.style.base.radius",
    },
    {
      name: "breakpoint tak dikenal",
      path: ["nodes", "n_hero000001", "style", "desktopXL"],
      value: {},
      issueAt: "nodes.n_hero000001.style",
    },
    {
      name: "flex tanpa direction (DM-026)",
      path: ["nodes", "n_hero000001", "style", "base", "layout", "direction"],
      value: REMOVE,
      issueAt: "nodes.n_hero000001.style.base.layout",
    },
    {
      name: "lebih dari 8 fills (DM-029)",
      path: ["nodes", "n_hero000001", "style", "base", "fills"],
      value: Array.from({ length: 9 }, () => ({ type: "solid", color: "#000000" })),
      issueAt: "nodes.n_hero000001.style.base.fills",
    },
    {
      name: "node non-container punya children (DM-008)",
      path: ["nodes", "n_herottl001", "children"],
      value: [],
      issueAt: "nodes.n_herottl001",
    },
    {
      name: "page dengan parentId (DM-006)",
      path: ["nodes", "pg_home000001", "parentId"],
      value: "n_hero000001",
      issueAt: "nodes.pg_home000001.parentId",
    },
    {
      name: "node non-page dengan parentId null (DM-006)",
      path: ["nodes", "n_hero000001", "parentId"],
      value: null,
      issueAt: "nodes.n_hero000001.parentId",
    },
    {
      name: "ID frame berprefix page (DM-007)",
      path: ["nodes", "n_hero000001", "id"],
      value: "pg_hero000001",
      issueAt: "nodes.n_hero000001.id",
    },
    {
      name: "tag tidak diizinkan untuk text (DM-009)",
      path: ["nodes", "n_herottl001", "tag"],
      value: "div",
      issueAt: "nodes.n_herottl001.tag",
    },
    {
      name: "konten rich text di luar schema (DM-013)",
      path: ["nodes", "n_herottl001", "props", "content", "content", 0],
      value: { type: "image", attrs: { src: "x.png" } },
      issueAt: "nodes.n_herottl001.props.content.content.0",
    },
    {
      name: "path page huruf besar (DM-010)",
      path: ["nodes", "pg_about00001", "props", "path"],
      value: "/Tentang",
      issueAt: "nodes.pg_about00001.props.path",
    },
    {
      name: "fit image tak dikenal (DM-014)",
      path: ["nodes", "n_heroimg001", "props", "fit"],
      value: "stretch",
      issueAt: "nodes.n_heroimg001.props.fit",
    },
  ];

  it.each(cases)("menolak $name", ({ path, value, issueAt }) => {
    expectIssueAt(heroWith(path, value), issueAt);
  });
});

describe("SiteDocumentSchema — invariant flat map", () => {
  it("menolak key nodes yang berbeda dengan node.id", () => {
    const doc = heroDocument();
    const { pg_about00001: page, ...otherNodes } = doc.nodes;
    const nodes = { ...otherNodes, pg_about00002: page };

    expectIssueAt({ ...doc, nodes }, "nodes.pg_about00002.id");
  });

  it("menolak pageOrder yang merujuk node bukan page", () => {
    expectIssueAt(heroWith(["pageOrder", 1], "pg_missing0001"), "pageOrder.1");
  });

  it("menolak page yang tidak ada di pageOrder (DM-006)", () => {
    expectIssueAt(heroWith(["pageOrder"], ["pg_home000001"]), "nodes.pg_about00001");
  });

  it("menolak child yang tidak ada di nodes", () => {
    expectIssueAt(
      heroWith(["nodes", "n_hero000001", "children"], ["n_herottl001", "n_heroimg001", "n_ghost00001"]),
      "nodes.n_hero000001.children.2",
    );
  });

  it("menolak node yang tidak dicantumkan di children parent-nya", () => {
    expectIssueAt(heroWith(["nodes", "n_hero000001", "children"], ["n_herottl001"]), "nodes.n_heroimg001.parentId");
  });

  it("menolak child yang parentId-nya menunjuk node lain", () => {
    expectIssueAt(heroWith(["nodes", "n_heroimg001", "parentId"], "pg_home000001"), "nodes.n_hero000001.children.1");
  });

  it("menolak image yang asset-nya tidak terdaftar (DM-014)", () => {
    expectIssueAt(heroWith(["assets"], {}), "nodes.n_heroimg001.props.image.assetId");
  });

  it("menolak image berukuran hug di base maupun patch (DM-027)", () => {
    expectIssueAt(
      heroWith(["nodes", "n_heroimg001", "style", "base", "size", "height"], { mode: "hug" }),
      "nodes.n_heroimg001.style.base.size.height",
    );
    expectIssueAt(
      heroWith(["nodes", "n_heroimg001", "style", "mobile", "size", "height"], { mode: "hug" }),
      "nodes.n_heroimg001.style.mobile.size.height",
    );
  });

  it("menolak siklus parent-child yang tidak terhubung ke page", () => {
    const doc = minimalDocument();
    const frame = (id: string, parentId: string) => ({
      id,
      type: "frame" as const,
      name: id,
      parentId,
      children: [parentId],
      visible: true,
      locked: false,
      style: { base: {} },
      props: {},
    });
    const nodes = {
      ...doc.nodes,
      n_loopa00001: frame("n_loopa00001", "n_loopb00001"),
      n_loopb00001: frame("n_loopb00001", "n_loopa00001"),
    };

    expectIssueAt({ ...doc, nodes }, "nodes.n_loopa00001");
  });
});

describe("CURRENT_SCHEMA_VERSION (spec 01 §19)", () => {
  it("semua fixture memakai versi schema terbaru", async () => {
    const { CURRENT_SCHEMA_VERSION } = await import("./document");
    const fixtures = await import("../../test/fixtures");
    for (const make of [
      fixtures.heroDocument,
      fixtures.minimalDocument,
      fixtures.nestedDocument,
      fixtures.landing200,
    ]) {
      expect(make().schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    }
  });
});
