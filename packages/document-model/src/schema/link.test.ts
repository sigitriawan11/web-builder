import { describe, expect, it } from "vitest";
import { heroDocument } from "../../test/fixtures/basic-documents";
import { findBrokenLinks } from "../query/links";
import { lintDocument } from "../validate/lint";
import { SiteDocumentSchema } from "./document";
import type { SiteDocument } from "./index";
import { LinkValueSchema, normalizeLinkInput, normalizePhone } from "./link";

// T1.8.13: LinkValue (DM-056) — normalisasi nomor, sanitasi href, rujukan page/anchor.
describe("normalizePhone (AC DM-056)", () => {
  it.each([
    ["081234567890", "6281234567890"],
    ["0812-3456-7890", "6281234567890"],
    ["+62 812 3456 7890", "6281234567890"],
    ["+62 (0)812.3456.7890", "6281234567890"],
    ["6281234567890", "6281234567890"],
    ["0062812345678", "62812345678"],
    ["+65 9123 4567", "6591234567"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "0", "abc", "+0812345678", "08123", "0812345678901234567"])("menolak %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("normalizeLinkInput", () => {
  it("menormalkan phone/whatsapp lalu lolos schema; input lain apa adanya", () => {
    const wa = normalizeLinkInput({ type: "whatsapp", phone: "0812 3456 7890", message: "Halo" });
    expect(LinkValueSchema.parse(wa)).toEqual({ type: "whatsapp", phone: "6281234567890", message: "Halo" });
    expect(LinkValueSchema.parse(normalizeLinkInput({ type: "url", href: "  https://contoh.id  " }))).toEqual({
      type: "url",
      href: "https://contoh.id",
    });
    expect(LinkValueSchema.safeParse(normalizeLinkInput({ type: "phone", phone: "halo" })).success).toBe(false);
    expect(normalizeLinkInput("x")).toBe("x");
  });

  it.each([
    "javascript:alert(1)",
    " JavaScript:alert(1)",
    "data:text/html,<b>x</b>",
    "vbscript:x",
    "ftp://x.id",
    "//evil.id",
  ])("href %j tetap ditolak setelah normalisasi", (href) => {
    expect(LinkValueSchema.safeParse(normalizeLinkInput({ type: "url", href })).success).toBe(false);
  });
});

describe("rujukan link page/anchor", () => {
  const withLink = (link: unknown, nodeId = "n_heroimg001"): SiteDocument => {
    const doc = heroDocument();
    const node = doc.nodes[nodeId];
    if (!node || (node.type !== "image" && node.type !== "frame")) throw new Error("fixture berubah");
    (node.props as { link?: unknown }).link = link;
    return SiteDocumentSchema.parse(doc);
  };

  it("link valid tidak dilaporkan (page, page+anchor, anchor di page sama, frame berlink)", () => {
    expect(findBrokenLinks(withLink({ type: "page", pageId: "pg_about00001" }))).toEqual([]);
    expect(findBrokenLinks(withLink({ type: "page", pageId: "pg_home000001", anchorNodeId: "n_hero000001" }))).toEqual(
      [],
    );
    expect(findBrokenLinks(withLink({ type: "anchor", nodeId: "n_herottl001" }))).toEqual([]);
    expect(findBrokenLinks(withLink({ type: "anchor", nodeId: "n_herottl001" }, "n_hero000001"))).toEqual([]);
  });

  it("page hilang, anchor di page lain / tidak ada / ke page → dilaporkan dengan path", () => {
    expect(findBrokenLinks(withLink({ type: "page", pageId: "pg_gone000001" }))).toEqual([
      expect.objectContaining({
        reason: "PAGE_MISSING",
        nodeId: "n_heroimg001",
        path: ["nodes", "n_heroimg001", "props", "link"],
      }),
    ]);
    expect(findBrokenLinks(withLink({ type: "page", pageId: "pg_about00001", anchorNodeId: "n_hero000001" }))).toEqual([
      expect.objectContaining({ reason: "ANCHOR_MISSING" }),
    ]);
    for (const nodeId of ["n_gone0000001", "pg_home000001"]) {
      expect(findBrokenLinks(withLink({ type: "anchor", nodeId })), nodeId).toEqual([
        expect.objectContaining({ reason: "ANCHOR_MISSING" }),
      ]);
    }
  });

  it("link di mark rich text ikut diperiksa & muncul sebagai lint BROKEN_LINK (warning, dokumen tetap valid)", () => {
    const doc = heroDocument();
    const title = doc.nodes.n_herottl001;
    if (title?.type !== "text") throw new Error("fixture berubah");
    title.props.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Tentang",
              marks: [{ type: "link", attrs: { link: { type: "page", pageId: "pg_gone000001" } } }],
            },
          ],
        },
      ],
    };
    expect(SiteDocumentSchema.safeParse(doc).success).toBe(true);
    expect(findBrokenLinks(doc)[0]?.path).toEqual([
      "nodes",
      "n_herottl001",
      "props",
      "content",
      "content",
      0,
      "content",
      0,
      "marks",
      0,
      "attrs",
      "link",
    ]);
    expect(lintDocument(doc)).toContainEqual(
      expect.objectContaining({ code: "BROKEN_LINK", pageId: "pg_home000001", nodeId: "n_herottl001" }),
    );
  });
});
