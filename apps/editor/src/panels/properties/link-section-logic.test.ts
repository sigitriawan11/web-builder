import type { SiteDocument } from "@platform/document-model";
import { landing200 } from "@platform/document-model/fixtures";
import { describe, expect, it } from "vitest";
import { buildNodeLink, draftLink, formFromLink, pageOf, summarizeLink } from "./link-section-logic";

const EMPTY = { value: "", pageId: "", anchorId: "", newTab: false };

describe("buildNodeLink", () => {
  it("membangun link page/anchor dari pilihan dropdown", () => {
    expect(buildNodeLink("page", { ...EMPTY, pageId: "pg_home01" })).toEqual({ type: "page", pageId: "pg_home01" });
    expect(buildNodeLink("anchor", { ...EMPTY, anchorId: "n_sect01abc" })).toEqual({
      type: "anchor",
      nodeId: "n_sect01abc",
    });
  });

  it("target kosong → null (tidak valid)", () => {
    expect(buildNodeLink("page", EMPTY)).toBeNull();
    expect(buildNodeLink("anchor", EMPTY)).toBeNull();
  });

  it("URL http(s) valid; javascript: ditolak", () => {
    expect(buildNodeLink("url", { ...EMPTY, value: "https://contoh.com" })).toEqual({
      type: "url",
      href: "https://contoh.com",
    });
    // biome-ignore lint/suspicious/noExplicitAny: menguji input berbahaya ditolak schema.
    expect(buildNodeLink("url", { ...EMPTY, value: "javascript:alert(1)" } as any)).toBeNull();
  });

  it("newTab disertakan hanya bila dicentang", () => {
    expect(buildNodeLink("url", { ...EMPTY, value: "https://a.id", newTab: true })).toEqual({
      type: "url",
      href: "https://a.id",
      newTab: true,
    });
    expect(buildNodeLink("url", { ...EMPTY, value: "https://a.id" })).not.toHaveProperty("newTab");
  });

  it("nomor telepon/WA Indonesia dinormalisasi ke 62… (DM-056)", () => {
    expect(buildNodeLink("phone", { ...EMPTY, value: "0812-3456-7890" })).toEqual({
      type: "phone",
      phone: "6281234567890",
    });
    expect(buildNodeLink("whatsapp", { ...EMPTY, value: "+62 812 3456 7890" })).toEqual({
      type: "whatsapp",
      phone: "6281234567890",
    });
  });

  it("email di-trim", () => {
    expect(buildNodeLink("email", { ...EMPTY, value: "  nama@contoh.com " })).toEqual({
      type: "email",
      to: "nama@contoh.com",
    });
  });
});

describe("draftLink", () => {
  it("url menyertakan href mentah (validasi di buildNodeLink)", () => {
    expect(draftLink("url", { ...EMPTY, value: " https://a.id " })).toEqual({ type: "url", href: "https://a.id" });
  });
});

describe("formFromLink", () => {
  it("round-trip page/url/whatsapp", () => {
    expect(formFromLink({ type: "page", pageId: "pg_000001" })).toEqual({
      kind: "page",
      form: { ...EMPTY, pageId: "pg_000001" },
    });
    expect(formFromLink({ type: "url", href: "https://a.id", newTab: true })).toEqual({
      kind: "url",
      form: { ...EMPTY, value: "https://a.id", newTab: true },
    });
    expect(formFromLink({ type: "whatsapp", phone: "6281234" })).toEqual({
      kind: "whatsapp",
      form: { ...EMPTY, value: "6281234" },
    });
  });

  it("tanpa link → default url kosong", () => {
    expect(formFromLink(undefined)).toEqual({ kind: "url", form: EMPTY });
  });
});

describe("summarizeLink", () => {
  it("page memakai judul page bila ada", () => {
    expect(summarizeLink({ type: "page", pageId: "pg_000001" }, [{ id: "pg_000001", title: "Beranda" }])).toBe(
      "Beranda",
    );
    expect(summarizeLink({ type: "page", pageId: "pg_000099" }, [])).toBe("page");
  });
  it("url/wa ringkas", () => {
    expect(summarizeLink({ type: "url", href: "https://a.id" }, [])).toBe("https://a.id");
    expect(summarizeLink({ type: "whatsapp", phone: "6281234" }, [])).toBe("wa.me/6281234");
  });
});

describe("pageOf", () => {
  it("menyusuri parentId sampai page root", () => {
    const doc = landing200() as SiteDocument;
    const pageId = doc.pageOrder[0] ?? "";
    // Node non-page apa pun harus memetakan ke page root fixture (satu page).
    const child = Object.values(doc.nodes).find((node) => node.type !== "page");
    expect(child).toBeDefined();
    if (child) expect(pageOf(doc.nodes, child.id)).toBe(pageId);
    expect(pageOf(doc.nodes, "n_tidak-ada")).toBeNull();
  });
});
