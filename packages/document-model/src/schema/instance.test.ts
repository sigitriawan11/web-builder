import { describe, expect, it } from "vitest";
import { InstanceNodeSchema, NodeSchema, SlotNodeSchema } from "./nodes";

const base = { name: "X", visible: true, locked: false, style: { base: {} } };

const instance = {
  ...base,
  id: "n_nav0000001",
  type: "instance",
  parentId: "pg_home000001",
  props: {
    componentId: "cmp_navbar0001",
    version: 4,
    variant: { layout: "logoLeft" },
    propValues: { brandName: "Toko Kue Budi", accent: { $token: "color.accent" } },
    overrides: { n_ctabtn0001: { style: { base: { opacity: 0.8 } } } },
    slots: { body: ["n_child00001"] },
  },
};

describe("InstanceNode (DM-018)", () => {
  it("valid & masuk NodeSchema site", () => {
    expect(InstanceNodeSchema.safeParse(instance).success).toBe(true);
    expect(NodeSchema.safeParse(instance).success).toBe(true);
  });

  it("menolak propValues berisi $prop (nilai site harus literal)", () => {
    const bad = { ...instance, props: { ...instance.props, propValues: { brandName: { $prop: "heading" } } } };
    expect(InstanceNodeSchema.safeParse(bad).success).toBe(false);
  });

  it("menolak children (instance tidak punya children) & version negatif; version 0 = rujukan draft (CMP-011)", () => {
    expect(InstanceNodeSchema.safeParse({ ...instance, children: [] }).success).toBe(false);
    // version 0 = rujukan draft terbaru (Mode Admin, Option A) → VALID; negatif tetap ditolak.
    expect(InstanceNodeSchema.safeParse({ ...instance, props: { ...instance.props, version: 0 } }).success).toBe(true);
    expect(InstanceNodeSchema.safeParse({ ...instance, props: { ...instance.props, version: -1 } }).success).toBe(
      false,
    );
  });
});

describe("SlotNode (DM-019)", () => {
  const slot = {
    ...base,
    id: "n_slot000001",
    type: "slot",
    parentId: "n_root000001",
    children: ["n_default0001"],
    props: { slotName: "body", allowedTypes: ["text", "image"], maxChildren: 3 },
  };

  it("valid sebagai SlotNode, TAPI ditolak di NodeSchema site (hanya di ComponentDefinition)", () => {
    expect(SlotNodeSchema.safeParse(slot).success).toBe(true);
    expect(NodeSchema.safeParse(slot).success).toBe(false);
  });

  it("slotName wajib camelCase", () => {
    expect(SlotNodeSchema.safeParse({ ...slot, props: { slotName: "Not-Camel" } }).success).toBe(false);
  });
});
