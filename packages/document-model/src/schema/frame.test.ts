import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { heroDocument } from "../../test/fixtures/basic-documents";
import { mergeStyle } from "../ops/merge-style";
import { jsonToYDoc, yDocToJson } from "../yjs/mapping";
import { SiteDocumentSchema } from "./document";
import type { Node, SiteDocument } from "./index";

// T1.8.6: frame & layout flex (DM-011, DM-026). Grid = P1 · M2 → ditolak sampai dibangun.
const SECTION = "n_hero000001";
const TITLE = "n_herottl001";

const withSectionStyle = (style: unknown) => {
  const doc = heroDocument();
  (doc.nodes[SECTION] as Node).style = style as Node["style"];
  return doc;
};
const valid = (doc: SiteDocument) => SiteDocumentSchema.safeParse(doc).success;

describe("frame flex (DM-011, DM-026)", () => {
  it("contoh hero spec DM-011 (token, padding, minHeight, override mobile) valid", () => {
    const doc = withSectionStyle({
      base: {
        layout: {
          mode: "flex",
          direction: "column",
          gap: { $token: "space.6" },
          align: "center",
          justify: "center",
          padding: {
            top: { $token: "space.16" },
            right: { $token: "space.8" },
            bottom: { $token: "space.16" },
            left: { $token: "space.8" },
          },
        },
        size: { width: { mode: "fill" }, height: { mode: "hug" }, minHeight: { value: 560, unit: "px" } },
        fills: [{ type: "solid", color: { $token: "color.surface" } }],
      },
      mobile: {
        layout: { padding: { top: { $token: "space.10" }, bottom: { $token: "space.10" } } },
        size: { minHeight: { value: 420, unit: "px" } },
      },
    });
    expect(SiteDocumentSchema.safeParse(doc).error?.issues ?? []).toEqual([]);
  });

  it.each(["start", "center", "end", "stretch", "baseline"])("align %s diterima", (align) => {
    expect(valid(withSectionStyle({ base: { layout: { mode: "flex", direction: "row", align } } }))).toBe(true);
  });

  it.each(["start", "center", "end", "spaceBetween", "spaceAround", "spaceEvenly"])(
    "justify %s diterima",
    (justify) => {
      expect(valid(withSectionStyle({ base: { layout: { mode: "flex", direction: "row", justify } } }))).toBe(true);
    },
  );

  it("padding sebagian valid (sisi lain default 0); wrap + crossGap valid", () => {
    expect(
      valid(
        withSectionStyle({
          base: {
            layout: {
              mode: "flex",
              direction: "row",
              wrap: true,
              crossGap: { value: 12, unit: "px" },
              padding: { top: { value: 8, unit: "px" } },
            },
          },
        }),
      ),
    ).toBe(true);
  });

  it.each([
    ["grid (P1 · M2)", { mode: "grid", columns: { type: "repeat", count: 3 } }],
    ["reverse (P2)", { mode: "flex", direction: "row", reverse: true }],
    ["justify asing", { mode: "flex", direction: "row", justify: "spaceBetweenish" }],
    ["flex tanpa direction", { mode: "flex" }],
  ])("%s ditolak", (_label, layout) => {
    expect(valid(withSectionStyle({ base: { layout } }))).toBe(false);
  });
});

describe("layout hanya untuk container (DM-026)", () => {
  it.each(["base", "mobile"] as const)("text dengan layout di %s ditolak", (breakpoint) => {
    const doc = heroDocument();
    const title = doc.nodes[TITLE] as Node;
    title.style = {
      ...title.style,
      [breakpoint]: {
        ...(title.style[breakpoint] ?? {}),
        layout: breakpoint === "base" ? { mode: "none" } : { gap: null },
      },
    } as Node["style"];
    expect((SiteDocumentSchema.safeParse(doc).error?.issues ?? []).map((issue) => issue.path.join("."))).toContain(
      `nodes.${TITLE}.style.${breakpoint}.layout`,
    );
  });
});

describe("flexChild (DM-026 FlexChildStyle)", () => {
  it("valid di anak; nilai tak dikenal / grow negatif ditolak", () => {
    const doc = heroDocument();
    const title = doc.nodes[TITLE] as Node;
    title.style = { ...title.style, base: { ...title.style.base, flexChild: { alignSelf: "center", grow: 1 } } };
    expect(valid(doc)).toBe(true);
    title.style.base = { ...title.style.base, flexChild: { grow: -1 } };
    expect(valid(doc)).toBe(false);
    title.style.base = { ...title.style.base, flexChild: { order: 2 } as never };
    expect(valid(doc)).toBe(false);
  });

  it("patch breakpoint di-merge per field; null menghapus field", () => {
    const base = { flexChild: { alignSelf: "center" as const, grow: 1 } };
    expect(mergeStyle(base, { flexChild: { alignSelf: "stretch" } })).toEqual({
      flexChild: { alignSelf: "stretch", grow: 1 },
    });
    expect(mergeStyle(base, { flexChild: { grow: null } })).toEqual({ flexChild: { alignSelf: "center" } });
  });

  it("round-trip Yjs lossless", () => {
    const doc = heroDocument();
    const title = doc.nodes[TITLE] as Node;
    title.style = { ...title.style, mobile: { flexChild: { alignSelf: "start", shrink: 0 } } };
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(jsonToYDoc(SiteDocumentSchema.parse(doc))));
    expect(yDocToJson(ydoc)).toEqual(doc);
  });
});
