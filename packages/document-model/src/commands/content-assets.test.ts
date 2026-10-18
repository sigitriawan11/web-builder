import { describe, expect, it } from "vitest";
import { heroDocument } from "../../test/fixtures/basic-documents";
import type { SiteDocument } from "../schema";
import { jsonToYDoc, yDocToJson } from "../yjs/mapping";
import { runCommand } from "./command";
import { registerAsset, setImage } from "./content";

const ORIGIN = { kind: "user", sessionId: "test" } as const;
const ID = "ast_img0001abc";

describe("registerAsset (DM-057)", () => {
  it("menambah AssetEntry ke doc.assets", () => {
    const doc = jsonToYDoc(heroDocument());
    const result = runCommand({ doc, origin: ORIGIN }, registerAsset, {
      id: ID,
      entry: { kind: "image", mime: "image/webp", width: 48, height: 32, blurhash: "L6PZ" },
    });
    expect(result.ok).toBe(true);
    expect((yDocToJson(doc) as SiteDocument).assets[ID]).toEqual({
      kind: "image",
      mime: "image/webp",
      width: 48,
      height: 32,
      blurhash: "L6PZ",
    });
  });

  it("asset terdaftar bisa dipakai setImage pada node image", () => {
    const doc = jsonToYDoc(heroDocument());
    runCommand({ doc, origin: ORIGIN }, registerAsset, { id: ID, entry: { kind: "image", mime: "image/png" } });
    const result = runCommand({ doc, origin: ORIGIN }, setImage, {
      id: "n_heroimg001",
      image: { assetId: ID, alt: "Logo" },
    });
    expect(result.ok).toBe(true);
    const node = (yDocToJson(doc) as SiteDocument).nodes.n_heroimg001;
    expect(node?.type === "image" && node.props.image.assetId).toBe(ID);
  });

  it("entry tidak valid ditolak", () => {
    const doc = jsonToYDoc(heroDocument());
    // kind di luar enum.
    const result = runCommand({ doc, origin: ORIGIN }, registerAsset, {
      id: ID,
      // biome-ignore lint/suspicious/noExplicitAny: menguji input tidak valid.
      entry: { kind: "bogus", mime: "x" } as any,
    });
    expect(result.ok).toBe(false);
  });
});
