import { describe, expect, it } from "vitest";
import { setupDoc } from "../test/command-harness";
import { heroDocument } from "../test/fixtures/basic-documents";
import { moveNode, runCommand, updateStyle } from "./commands";
import { createId, ID_PREFIXES } from "./ids";
import {
  AssetIdSchema,
  CollectionIdSchema,
  ComponentIdSchema,
  InteractionIdSchema,
  NodeIdSchema,
  PageIdSchema,
  type SiteDocument,
  TemplateIdSchema,
} from "./schema";

// T1.8.3 (DM-007): schema ID per jenis entitas & stabilitas ID.

describe("schema ID per jenis entitas", () => {
  const schemas = {
    pg: PageIdSchema,
    n: NodeIdSchema,
    cmp: ComponentIdSchema,
    ast: AssetIdSchema,
    ix: InteractionIdSchema,
    tpl: TemplateIdSchema,
    col: CollectionIdSchema,
  } as const;

  it.each(ID_PREFIXES)("createId(%s) diterima schema-nya", (prefix) => {
    expect(schemas[prefix].safeParse(createId(prefix)).success).toBe(true);
  });

  it("ID jenis lain ditolak (node tidak bisa merujuk asset, dst.)", () => {
    expect(AssetIdSchema.safeParse(createId("n")).success).toBe(false);
    expect(ComponentIdSchema.safeParse(createId("ast")).success).toBe(false);
    expect(InteractionIdSchema.safeParse(createId("n")).success).toBe(false);
    expect(PageIdSchema.safeParse(createId("n")).success).toBe(false);
    // NodeIdSchema mencakup page & node lain (keduanya node di flat map).
    expect(NodeIdSchema.safeParse(createId("pg")).success).toBe(true);
  });
});

describe("ID stabil (AC DM-007)", () => {
  const snapshotIds = (doc: SiteDocument) =>
    Object.entries(doc.nodes)
      .map(([key, node]) => `${key}=${node.id}`)
      .sort();

  it("move, restyle base, dan override breakpoint tidak mengubah ID node mana pun", () => {
    const { ctx, read } = setupDoc(heroDocument());
    const before = snapshotIds(read());

    expect(runCommand(ctx, moveNode, { id: "n_heroimg001", newParentId: "pg_home000001", index: 0 }).ok).toBe(true);
    expect(
      runCommand(ctx, updateStyle, { ids: ["n_hero000001"], patch: { layout: { gap: { value: 8, unit: "px" } } } }).ok,
    ).toBe(true);
    expect(
      runCommand(ctx, updateStyle, {
        ids: ["n_hero000001"],
        breakpoint: "mobile",
        patch: { layout: { gap: { value: 4, unit: "px" } } },
      }).ok,
    ).toBe(true);

    expect(snapshotIds(read())).toEqual(before);
  });
});
