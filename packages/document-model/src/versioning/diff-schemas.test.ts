import { describe, expect, it } from "vitest";
import type { ComponentDefinition } from "../schema/component";
import { diffComponentSchemas } from "./diff-schemas";

const BASE = {
  schemaVersion: 1,
  id: "cmp_diff0001",
  version: 1,
  name: "X",
  category: "card",
  propsSchema: [
    { key: "title", label: { id: "J", en: "T" }, type: "text", default: "" },
    {
      key: "tone",
      label: { id: "N", en: "N" },
      type: "enum",
      default: "a",
      options: [
        { value: "a", label: { id: "A", en: "A" } },
        { value: "b", label: { id: "B", en: "B" } },
      ],
    },
  ],
  variantAxes: [{ name: "size", options: ["sm", "md"], default: "sm" }],
  rootId: "n_root0001",
  nodes: { n_root0001: { id: "n_root0001", type: "frame", parentId: null } },
} as unknown as ComponentDefinition;

const clone = (): ComponentDefinition => JSON.parse(JSON.stringify(BASE)) as ComponentDefinition;
type P = { key: string; type: string; required?: boolean; default?: unknown; options?: { value: string }[] };
const props = (d: ComponentDefinition) => d.propsSchema as unknown as P[];

describe("diffComponentSchemas (CMP-042)", () => {
  it("identik → patch, tanpa perubahan", () => {
    const diff = diffComponentSchemas(clone(), clone());
    expect(diff).toEqual({ bump: "patch", changes: [] });
  });

  it("prop dihapus → major", () => {
    const next = clone();
    next.propsSchema = [props(next)[0]] as never;
    const diff = diffComponentSchemas(clone(), next);
    expect(diff.bump).toBe("major");
    expect(diff.changes.some((c) => c.kind === "prop-removed" && c.key === "tone")).toBe(true);
  });

  it("prop baru (dengan default) → minor", () => {
    const next = clone();
    props(next).push({ key: "showBadge", type: "boolean", default: false } as never);
    const diff = diffComponentSchemas(clone(), next);
    expect(diff.bump).toBe("minor");
    expect(diff.changes.some((c) => c.kind === "prop-added" && c.key === "showBadge")).toBe(true);
  });

  it("tipe prop berubah → major", () => {
    const next = clone();
    const title = props(next).find((p) => p.key === "title");
    if (title) title.type = "number";
    expect(diffComponentSchemas(clone(), next).bump).toBe("major");
  });

  it("required baru tanpa default → major", () => {
    // image prop (tanpa default) menjadi required.
    const prev = clone();
    (prev.propsSchema as unknown as P[]).push({ key: "pic", type: "image" } as never);
    const n2 = JSON.parse(JSON.stringify(prev)) as ComponentDefinition;
    const pic = (n2.propsSchema as unknown as P[]).find((p) => p.key === "pic");
    if (pic) pic.required = true;
    expect(diffComponentSchemas(prev, n2).bump).toBe("major");
  });

  it("enum: opsi dihapus → major; ditambah → minor", () => {
    const removed = clone();
    const toneRemoved = props(removed).find((p) => p.key === "tone");
    if (toneRemoved) toneRemoved.options = [{ value: "a" }];
    expect(diffComponentSchemas(clone(), removed).bump).toBe("major");

    const added = clone();
    props(added)
      .find((p) => p.key === "tone")
      ?.options?.push({ value: "c" });
    const diff = diffComponentSchemas(clone(), added);
    expect(diff.bump).toBe("minor");
    expect(diff.changes.some((c) => c.kind === "enum-option-added")).toBe(true);
  });

  it("variant axis: hapus/opsi hapus → major; tambah/opsi tambah → minor", () => {
    const removedAxis = clone();
    removedAxis.variantAxes = [];
    expect(diffComponentSchemas(clone(), removedAxis).bump).toBe("major");

    const addedOpt = clone();
    const axis = (addedOpt.variantAxes as { options: string[] }[])[0];
    if (axis) axis.options.push("lg");
    expect(diffComponentSchemas(clone(), addedOpt).bump).toBe("minor");

    const addedAxis = clone();
    (addedAxis.variantAxes as unknown[]).push({ name: "tone", options: ["x"], default: "x" });
    expect(diffComponentSchemas(clone(), addedAxis).changes.some((c) => c.kind === "axis-added")).toBe(true);
  });

  it("node dihapus → major; node baru → minor", () => {
    const removed = clone();
    removed.nodes = {} as never;
    expect(diffComponentSchemas(clone(), removed).bump).toBe("major");

    const added = clone();
    (added.nodes as Record<string, unknown>).n_new0001 = { id: "n_new0001", type: "text", parentId: "n_root0001" };
    const diff = diffComponentSchemas(clone(), added);
    expect(diff.bump).toBe("minor");
    expect(diff.changes.some((c) => c.kind === "node-added")).toBe(true);
  });
});
