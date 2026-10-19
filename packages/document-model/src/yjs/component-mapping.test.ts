import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { validateComponentDefinition } from "../validate/component";
import { componentDefToYDoc, yDocToComponentDef } from "./component-mapping";

// L1 (T3.4.2, Approach A): round-trip ComponentDefinition ↔ Y.Doc. Fokus kehalusan: `content` bisa `$prop` (JSON apa
// adanya) ATAU rich text (Y.XmlFragment), tipe `slot`, variantAxes/variants. Hasil harus identik & tetap valid.
const label = { id: "L", en: "L" };

// Tombol: variantAxes + variants + `content` = `$prop`.
function buttonDef() {
  return {
    schemaVersion: 1,
    id: "cmp_buttonprimary",
    version: 1,
    name: "Button / Primary",
    category: "button" as const,
    description: "Tombol utama dengan tone.",
    propsSchema: [
      { key: "label", label, type: "text", default: "Klik" },
      { key: "link", label, type: "link" },
    ],
    variantAxes: [{ name: "tone", options: ["primary", "ghost"], default: "primary" }],
    variants: [{ when: { tone: "ghost" }, overrides: { n_btnroot001: { style: { base: { fills: [] } } } } }],
    rootId: "n_btnroot001",
    nodes: {
      n_btnroot001: {
        id: "n_btnroot001",
        type: "frame",
        name: "Button",
        parentId: null,
        visible: true,
        locked: false,
        tag: "div",
        children: ["n_btnlabel01"],
        style: { base: { fills: [{ type: "solid", color: { $token: "color.primary" } }] } },
        props: { role: "button", link: { $prop: "link" } },
      },
      n_btnlabel01: {
        id: "n_btnlabel01",
        type: "text",
        name: "Label",
        parentId: "n_btnroot001",
        visible: true,
        locked: false,
        tag: "span",
        style: { base: {} },
        props: { content: { $prop: "label" } },
      },
    },
  };
}

// Section: tipe `slot` + isi default.
function sectionWithSlot() {
  return {
    schemaVersion: 1,
    id: "cmp_sectionslot",
    version: 1,
    name: "Section / Slot",
    category: "section" as const,
    propsSchema: [{ key: "heading", label, type: "text", default: "Judul" }],
    rootId: "n_secroot001",
    nodes: {
      n_secroot001: {
        id: "n_secroot001",
        type: "frame",
        name: "Section",
        parentId: null,
        visible: true,
        locked: false,
        tag: "section",
        children: ["n_sectitle01", "n_secslot001"],
        style: { base: {} },
        props: { role: "section" },
      },
      n_sectitle01: {
        id: "n_sectitle01",
        type: "text",
        name: "Title",
        parentId: "n_secroot001",
        visible: true,
        locked: false,
        tag: "h2",
        style: { base: {} },
        props: { content: { $prop: "heading" } },
      },
      n_secslot001: {
        id: "n_secslot001",
        type: "slot",
        name: "Body",
        parentId: "n_secroot001",
        visible: true,
        locked: false,
        children: [],
        style: { base: {} },
        props: { slotName: "body", allowedTypes: ["text", "image"] },
      },
    },
  };
}

// `content` rich text literal (default content, CMP-016) — harus lewat Y.XmlFragment & kembali utuh.
function richTextDef() {
  return {
    schemaVersion: 1,
    id: "cmp_richcard01",
    version: 1,
    name: "Rich Card",
    category: "card" as const,
    propsSchema: [],
    rootId: "n_rcroot0001",
    nodes: {
      n_rcroot0001: {
        id: "n_rcroot0001",
        type: "frame",
        name: "Card",
        parentId: null,
        visible: true,
        locked: false,
        tag: "div",
        children: ["n_rctext0001"],
        style: { base: {} },
        props: {},
      },
      n_rctext0001: {
        id: "n_rctext0001",
        type: "text",
        name: "Body",
        parentId: "n_rcroot0001",
        visible: true,
        locked: false,
        tag: "p",
        style: { base: {} },
        props: {
          content: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Halo dunia" }] }],
          },
        },
      },
    },
  };
}

describe("component Y.Doc codec (DM-058, Approach A)", () => {
  it.each([
    ["button ($prop + variants)", buttonDef()],
    ["section + slot", sectionWithSlot()],
    ["rich text literal", richTextDef()],
  ])("round-trip %s: def → Y.Doc → def identik & valid", (_name, def) => {
    const back = yDocToComponentDef(componentDefToYDoc(def));
    expect(back).toEqual(def);
    expect(validateComponentDefinition(back).ok).toBe(true);
  });

  it("menulis ke Y.Doc target yang diberikan dengan origin transaksi (untuk realtime)", () => {
    const target = new Y.Doc();
    const origins: unknown[] = [];
    target.on("afterTransaction", (tx: Y.Transaction) => origins.push(tx.origin));
    const returned = componentDefToYDoc(buttonDef(), target, "seed:init");
    expect(returned).toBe(target);
    expect(origins).toContain("seed:init");
  });
});
