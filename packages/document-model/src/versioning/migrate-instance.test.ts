import { describe, expect, it } from "vitest";
import type { InstanceProps } from "../schema/nodes";
import { type ComponentMigration, migrateInstance } from "./migrate-instance";

const base = (over: Partial<InstanceProps> = {}): InstanceProps =>
  ({ componentId: "cmp_card0001", version: 1, ...over }) as InstanceProps;

describe("migrateInstance (CMP-054)", () => {
  it("rename: nilai user dipindah ke key baru (data tak hilang)", () => {
    const mig: ComponentMigration = { fromMajor: 1, props: { title: { rename: "heading" } } };
    const { props } = migrateInstance(base({ propValues: { title: "Halo" } }), [mig]);
    expect(props.propValues).toEqual({ heading: "Halo" });
  });

  it("mapValues: nilai lama dipetakan", () => {
    const mig: ComponentMigration = { fromMajor: 1, props: { style: { mapValues: { ghost: "outline" } } } };
    const { props } = migrateInstance(base({ propValues: { style: "ghost" } }), [mig]);
    expect(props.propValues).toEqual({ style: "outline" });
  });

  it("setDefault: hanya mengisi bila prop belum ada", () => {
    const mig: ComponentMigration = { fromMajor: 1, props: { size: { setDefault: "md" } } };
    expect(migrateInstance(base(), [mig]).props.propValues).toEqual({ size: "md" });
    expect(migrateInstance(base({ propValues: { size: "lg" } }), [mig]).props.propValues).toEqual({ size: "lg" });
  });

  it("drop: menghapus prop + warning berisi nilai lama", () => {
    const note = { id: "Ikon selalu tampil", en: "Icon always shown" };
    const mig: ComponentMigration = { fromMajor: 1, props: { showIcon: { drop: true, note } } };
    const { props, warnings } = migrateInstance(base({ propValues: { showIcon: true } }), [mig]);
    expect(props.propValues).toBeUndefined();
    expect(warnings).toEqual([{ propKey: "showIcon", note, previousValue: true }]);
  });

  it("transform stringToRichText & moveInto", () => {
    const mig: ComponentMigration = {
      fromMajor: 1,
      props: { body: { transform: "stringToRichText" }, ctaText: { moveInto: "primaryCta.label" } },
    };
    const { props } = migrateInstance(base({ propValues: { body: "Hai", ctaText: "Pesan" } }), [mig]);
    const pv = props.propValues as Record<string, unknown>;
    expect(pv.body).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hai" }] }],
    });
    expect(pv.primaryCta).toEqual({ label: "Pesan" });
    expect("ctaText" in pv).toBe(false);
  });

  it("variant rename + mapValues", () => {
    const mig: ComponentMigration = {
      fromMajor: 1,
      variants: { tone: { rename: "style", mapValues: { solid: "primary" } } },
    };
    const { props } = migrateInstance(base({ variant: { tone: "solid" } }), [mig]);
    expect(props.variant).toEqual({ style: "primary" });
  });

  it("nodeIds remap override & slots rename", () => {
    const mig: ComponentMigration = {
      fromMajor: 1,
      nodeIds: { n_old00001: "n_new00001" },
      slots: { extra: "footer" },
    };
    const { props } = migrateInstance(
      base({
        overrides: { n_old00001: { visible: false } },
        slots: { extra: ["n_child0001"] },
      }),
      [mig],
    );
    expect(props.overrides).toEqual({ n_new00001: { visible: false } });
    expect(props.slots).toEqual({ footer: ["n_child0001"] });
  });

  it("berantai: migrasi dijalankan urut fromMajor (1→2)", () => {
    const m1: ComponentMigration = { fromMajor: 1, props: { title: { rename: "heading" } } };
    const m2: ComponentMigration = { fromMajor: 2, props: { heading: { rename: "label" } } };
    const { props } = migrateInstance(base({ propValues: { title: "X" } }), [m2, m1]);
    expect(props.propValues).toEqual({ label: "X" });
  });
});
