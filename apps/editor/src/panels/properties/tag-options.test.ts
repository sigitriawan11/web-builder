import { jsonToYDoc, type Node, runCommand, type SiteDocument, setTag, yDocToJson } from "@platform/document-model";
import { landing200 } from "@platform/document-model/fixtures";
import { describe, expect, it } from "vitest";
import { TAG_OPTIONS } from "./tag-options";

const ORIGIN = { kind: "user", sessionId: "test" } as const;

function firstOfType(doc: SiteDocument, type: Node["type"]): string {
  const found = Object.values(doc.nodes).find((node) => node.type === type);
  if (!found) throw new Error(`tidak ada node ${type} di fixture`);
  return found.id;
}

describe("TAG_OPTIONS valid untuk setTag (ED-218)", () => {
  for (const [type, tags] of Object.entries(TAG_OPTIONS)) {
    it(`semua tag ${type} diterima schema & tersimpan`, () => {
      const doc = jsonToYDoc(landing200());
      const id = firstOfType(yDocToJson(doc) as SiteDocument, type as Node["type"]);
      for (const tag of tags ?? []) {
        const result = runCommand({ doc, origin: ORIGIN }, setTag, { id, tag });
        expect(result.ok, `tag ${tag}`).toBe(true);
        expect((yDocToJson(doc) as SiteDocument).nodes[id]?.tag).toBe(tag);
      }
    });
  }

  it("tag asing ditolak", () => {
    const doc = jsonToYDoc(landing200());
    const id = firstOfType(yDocToJson(doc) as SiteDocument, "frame");
    expect(runCommand({ doc, origin: ORIGIN }, setTag, { id, tag: "marquee" }).ok).toBe(false);
  });
});
