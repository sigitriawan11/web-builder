import { describe, expect, it } from "vitest";
import type { ComponentDefinition, Node } from "../schema";
import { type ResolvedNode, resolveInstance } from "./resolve-instance";

const label = { id: "L", en: "L" };

// Button: prop `label` → teks; variant `tone` (ghost = tanpa fill).
const buttonDef = {
  schemaVersion: 1,
  id: "cmp_btn",
  version: 1,
  name: "Button",
  category: "button",
  propsSchema: [{ key: "label", label, type: "text", default: "Klik" }],
  variantAxes: [{ name: "tone", options: ["primary", "ghost"], default: "primary" }],
  variants: [{ when: { tone: "ghost" }, overrides: { n_btnroot: { style: { base: { fills: [] } } } } }],
  rootId: "n_btnroot",
  nodes: {
    n_btnroot: {
      id: "n_btnroot",
      type: "frame",
      name: "Button",
      parentId: null,
      visible: true,
      locked: false,
      tag: "div",
      children: ["n_btnlabel"],
      style: { base: { fills: [{ type: "solid", color: "#2563EB" }] } },
      props: { role: "button" },
    },
    n_btnlabel: {
      id: "n_btnlabel",
      type: "text",
      name: "Label",
      parentId: "n_btnroot",
      visible: true,
      locked: false,
      tag: "span",
      style: { base: {} },
      props: { content: { $prop: "label" } },
    },
  },
} as unknown as ComponentDefinition;

// Card: meneruskan `ctaLabel` ke instance Button bersarang.
const cardDef = {
  schemaVersion: 1,
  id: "cmp_card",
  version: 1,
  name: "Card",
  category: "card",
  propsSchema: [{ key: "ctaLabel", label, type: "text", default: "Beli" }],
  rootId: "n_cardroot",
  nodes: {
    n_cardroot: {
      id: "n_cardroot",
      type: "frame",
      name: "Card",
      parentId: null,
      visible: true,
      locked: false,
      children: ["n_cardbtn"],
      style: { base: {} },
      props: {},
    },
    n_cardbtn: {
      id: "n_cardbtn",
      type: "instance",
      name: "CTA",
      parentId: "n_cardroot",
      visible: true,
      locked: false,
      style: { base: {} },
      props: { componentId: "cmp_btn", version: 1, propValues: { label: { $prop: "ctaLabel" } } },
    },
  },
} as unknown as ComponentDefinition;

// Grid: meneruskan `ctaLabel` ke instance Card bersarang (3 level: grid → card → button).
const gridDef = {
  schemaVersion: 1,
  id: "cmp_grid",
  version: 1,
  name: "Grid",
  category: "section",
  propsSchema: [{ key: "ctaLabel", label, type: "text", default: "Pesan" }],
  rootId: "n_gridroot",
  nodes: {
    n_gridroot: {
      id: "n_gridroot",
      type: "frame",
      name: "Grid",
      parentId: null,
      visible: true,
      locked: false,
      tag: "section",
      children: ["n_gridcard"],
      style: { base: {} },
      props: { role: "section" },
    },
    n_gridcard: {
      id: "n_gridcard",
      type: "instance",
      name: "Card",
      parentId: "n_gridroot",
      visible: true,
      locked: false,
      style: { base: {} },
      props: { componentId: "cmp_card", version: 1, propValues: { ctaLabel: { $prop: "ctaLabel" } } },
    },
  },
} as unknown as ComponentDefinition;

// Nav: prop `list` menuItems + repeater (frame repeatProp) dengan template teks ber-$prop item.
const navDef = {
  schemaVersion: 1,
  id: "cmp_nav0001",
  version: 1,
  name: "Nav",
  category: "navbar",
  propsSchema: [
    {
      key: "menuItems",
      label,
      type: "list",
      itemSchema: [{ key: "label", label, type: "text", default: "" }],
      default: [],
    },
  ],
  rootId: "n_navroot01",
  nodes: {
    n_navroot01: {
      id: "n_navroot01",
      type: "frame",
      name: "Nav",
      parentId: null,
      visible: true,
      locked: false,
      children: ["n_navitem01"],
      style: { base: {} },
      props: { role: "generic", repeatProp: "menuItems" },
    },
    n_navitem01: {
      id: "n_navitem01",
      type: "text",
      name: "Item",
      parentId: "n_navroot01",
      visible: true,
      locked: false,
      tag: "span",
      style: { base: {} },
      props: { content: { $prop: "menuItems[].label" } },
    },
  },
} as unknown as ComponentDefinition;

// Flags: binding boolean (`visible`), enum+`eq` (`visible`), dan `fallback` (link prop tanpa default) — DM-047.
const flagsDef = {
  schemaVersion: 1,
  id: "cmp_flags01",
  version: 1,
  name: "Flags",
  category: "section",
  propsSchema: [
    { key: "showBadge", label, type: "boolean", default: true },
    {
      key: "align",
      label,
      type: "enum",
      default: "left",
      options: [
        { value: "left", label },
        { value: "center", label },
      ],
    },
    { key: "href", label, type: "link" },
  ],
  rootId: "n_flagroot",
  nodes: {
    n_flagroot: {
      id: "n_flagroot",
      type: "frame",
      name: "Flags",
      parentId: null,
      visible: true,
      locked: false,
      children: ["n_badge", "n_centeronly"],
      style: { base: {} },
      props: { role: "generic", link: { $prop: "href", fallback: { type: "url", url: "#fallback" } } },
    },
    n_badge: {
      id: "n_badge",
      type: "frame",
      name: "Badge",
      parentId: "n_flagroot",
      visible: { $prop: "showBadge" },
      locked: false,
      children: [],
      style: { base: {} },
      props: { role: "generic" },
    },
    n_centeronly: {
      id: "n_centeronly",
      type: "frame",
      name: "CenterOnly",
      parentId: "n_flagroot",
      visible: { $prop: "align", eq: "center" },
      locked: false,
      children: [],
      style: { base: {} },
      props: { role: "generic" },
    },
  },
} as unknown as ComponentDefinition;

const registry = new Map<string, ComponentDefinition>([
  ["cmp_btn@1", buttonDef],
  ["cmp_card@1", cardDef],
  ["cmp_grid@1", gridDef],
  ["cmp_nav0001@1", navDef],
  ["cmp_flags01@1", flagsDef],
]);
const ctx = {
  getComponent: (id: string, version: number) => registry.get(`${id}@${version}`),
  siteNode: () => undefined,
};

const instance = (props: Record<string, unknown>, extra: Record<string, unknown> = {}): Node & { type: "instance" } =>
  ({
    id: "n_inst0001",
    type: "instance",
    name: "Inst",
    parentId: "pg_home000001",
    visible: true,
    locked: false,
    style: { base: {} },
    props,
    ...extra,
  }) as unknown as Node & { type: "instance" };

const find = (node: ResolvedNode, pred: (n: ResolvedNode) => boolean): ResolvedNode | undefined => {
  if (pred(node)) return node;
  for (const child of node.children ?? []) {
    const hit = find(child, pred);
    if (hit) return hit;
  }
  return undefined;
};
const textOf = (node: ResolvedNode): string | undefined => {
  const content = node.props?.content as { content?: { content?: { text?: string }[] }[] } | undefined;
  return content?.content?.[0]?.content?.[0]?.text;
};

describe("resolveInstance (DM-051)", () => {
  it("substitusi prop + default + id ter-scope", () => {
    const root = resolveInstance(
      instance({ componentId: "cmp_btn", version: 1, propValues: { label: "Pesan via WA" } }),
      ctx,
    );
    expect(root.id).toBe("n_inst0001:n_btnroot");
    expect(root.sourceInstanceId).toBe("n_inst0001");
    const labelNode = find(root, (n) => n.type === "text");
    expect(textOf(labelNode as ResolvedNode)).toBe("Pesan via WA");
    // Prop kosong → default.
    const d = resolveInstance(instance({ componentId: "cmp_btn", version: 1 }), ctx);
    expect(textOf(find(d, (n) => n.type === "text") as ResolvedNode)).toBe("Klik");
  });

  it("variant: tone=ghost menghapus fills root; default primary mempertahankan", () => {
    const ghost = resolveInstance(instance({ componentId: "cmp_btn", version: 1, variant: { tone: "ghost" } }), ctx);
    expect((ghost.style.base as { fills?: unknown[] }).fills).toEqual([]);
    const primary = resolveInstance(instance({ componentId: "cmp_btn", version: 1 }), ctx);
    expect((primary.style.base as { fills?: unknown[] }).fills).toHaveLength(1);
  });

  it("override instance + merge style root dari instance", () => {
    const root = resolveInstance(
      instance(
        { componentId: "cmp_btn", version: 1, overrides: { n_btnlabel: { visible: false } } },
        { style: { base: { size: { width: { mode: "fill" } } } } },
      ),
      ctx,
    );
    expect(find(root, (n) => n.type === "text")?.visible).toBe(false);
    expect((root.style.base as { size?: { width?: { mode?: string } } }).size?.width?.mode).toBe("fill");
  });

  it("AC: instance bersarang 3 level; prop menembus & override menembus 2 level", () => {
    const root = resolveInstance(
      instance({
        componentId: "cmp_grid",
        version: 1,
        overrides: { "n_gridcard/n_cardbtn/n_btnroot": { visible: false } },
      }),
      ctx,
    );
    // ctaLabel default "Pesan" menembus grid → card → button → teks.
    expect(textOf(find(root, (n) => n.type === "text") as ResolvedNode)).toBe("Pesan");
    // Root button (2 level ke dalam) jadi visible:false lewat override path bertingkat.
    const btnRoot = find(root, (n) => n.id.endsWith(":n_btnroot"));
    expect(btnRoot?.visible).toBe(false);
  });

  it("repeater list (CMP-022): template diulang per item, scope `menuItems[].label`", () => {
    const root = resolveInstance(
      instance({
        componentId: "cmp_nav0001",
        version: 1,
        propValues: { menuItems: [{ label: "Fitur" }, { label: "Harga" }, { label: "Kontak" }] },
      }),
      ctx,
    );
    const items = root.children ?? [];
    expect(items).toHaveLength(3);
    expect(items.map((n) => textOf(n))).toEqual(["Fitur", "Harga", "Kontak"]);
    // ID unik per item.
    expect(new Set(items.map((n) => n.id)).size).toBe(3);
  });

  it("binding boolean, enum+eq, dan fallback (DM-047)", () => {
    const linkOf = (node: ResolvedNode) => (node.props as { link?: { url?: string } } | undefined)?.link;

    // Default: showBadge=true, align=left, href kosong → fallback dipakai.
    const def = resolveInstance(instance({ componentId: "cmp_flags01", version: 1 }), ctx);
    expect(find(def, (n) => n.id.endsWith(":n_badge"))?.visible).toBe(true);
    expect(find(def, (n) => n.id.endsWith(":n_centeronly"))?.visible).toBe(false);
    expect(linkOf(def)).toEqual({ type: "url", url: "#fallback" });

    // showBadge=false → badge tersembunyi; align=center → node eq terlihat.
    const flipped = resolveInstance(
      instance({ componentId: "cmp_flags01", version: 1, propValues: { showBadge: false, align: "center" } }),
      ctx,
    );
    expect(find(flipped, (n) => n.id.endsWith(":n_badge"))?.visible).toBe(false);
    expect(find(flipped, (n) => n.id.endsWith(":n_centeronly"))?.visible).toBe(true);

    // href di-set → nilai prop dipakai, bukan fallback.
    const withHref = resolveInstance(
      instance({ componentId: "cmp_flags01", version: 1, propValues: { href: { type: "url", url: "https://x.id" } } }),
      ctx,
    );
    expect(linkOf(withHref)).toEqual({ type: "url", url: "https://x.id" });
  });

  it("component hilang → placeholder (tidak crash)", () => {
    const warnings: string[] = [];
    const root = resolveInstance(instance({ componentId: "cmp_tidakada", version: 9 }), {
      ...ctx,
      onWarning: (code) => warnings.push(code),
    });
    expect(root.missingComponent).toEqual({ componentId: "cmp_tidakada", version: 9 });
    expect(warnings).toContain("MISSING_COMPONENT");
  });
});
