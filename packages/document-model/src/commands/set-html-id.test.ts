import { describe, expect, it } from "vitest";
import { heroDocument } from "../../test/fixtures/basic-documents";
import type { SiteDocument } from "../schema";
import { jsonToYDoc, yDocToJson } from "../yjs/mapping";
import { runCommand } from "./command";
import { setHtmlId } from "./node-fields";

const ORIGIN = { kind: "user", sessionId: "test" } as const;
const TITLE = "n_herottl001";
const IMAGE = "n_heroimg001";

function ctxOf() {
  return { doc: jsonToYDoc(heroDocument()), origin: ORIGIN };
}
const htmlIdOf = (doc: SiteDocument, id: string) => doc.nodes[id]?.htmlId;

describe("setHtmlId (ED-220/DM-008)", () => {
  it("memasang slug anchor pada node", () => {
    const ctx = ctxOf();
    expect(runCommand(ctx, setHtmlId, { id: TITLE, htmlId: "tim" }).ok).toBe(true);
    expect(htmlIdOf(yDocToJson(ctx.doc) as SiteDocument, TITLE)).toBe("tim");
  });

  it("menolak htmlId yang sudah dipakai node lain di page yang sama (keunikan)", () => {
    const ctx = ctxOf();
    expect(runCommand(ctx, setHtmlId, { id: TITLE, htmlId: "tim" }).ok).toBe(true);
    const dup = runCommand(ctx, setHtmlId, { id: IMAGE, htmlId: "tim" });
    expect(dup.ok).toBe(false);
    // htmlId lain tetap bisa dipasang.
    expect(runCommand(ctx, setHtmlId, { id: IMAGE, htmlId: "foto" }).ok).toBe(true);
  });

  it("menolak slug tidak valid (huruf besar/spasi) via schema input", () => {
    const ctx = ctxOf();
    expect(runCommand(ctx, setHtmlId, { id: TITLE, htmlId: "Tim Keren" }).ok).toBe(false);
  });

  it("htmlId null menghapus anchor", () => {
    const ctx = ctxOf();
    runCommand(ctx, setHtmlId, { id: TITLE, htmlId: "tim" });
    expect(runCommand(ctx, setHtmlId, { id: TITLE, htmlId: null }).ok).toBe(true);
    expect(htmlIdOf(yDocToJson(ctx.doc) as SiteDocument, TITLE)).toBeUndefined();
  });
});
