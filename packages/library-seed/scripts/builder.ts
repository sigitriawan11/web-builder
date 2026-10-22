// Builder subtree component seed (T3.11.x). Satu "design direction": semua pakai token theme (warna/spacing/radius/
// tipografi), auto-layout (flex), nama layer EN bermakna, tag semantik. Output = { rootIds, nodes } untuk field
// `definition.subtree` (lihat button-primary.component.json). ID node = `t_<prefix><n>` unik per component.

export type Json = Record<string, unknown>;
export const T = (ref: string): Json => ({ $token: ref });

export const richText = (text: string): Json => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

// Ukuran
export const FILL = { mode: "fill" } as const;
export const HUG = { mode: "hug" } as const;
export const fixed = (value: number, unit = "px"): Json => ({ mode: "fixed", value, unit });
export const size = (width: Json | typeof FILL | typeof HUG, height: Json | typeof FILL | typeof HUG): Json => ({
  width,
  height,
});

// Padding simetris / per sisi dari langkah token space.
export const padXY = (x: number, y: number): Json => ({
  top: T(`space.${y}`),
  right: T(`space.${x}`),
  bottom: T(`space.${y}`),
  left: T(`space.${x}`),
});
export const padAll = (step: number): Json => padXY(step, step);

export interface FlexOpts {
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "spaceBetween";
  gap?: number; // langkah token space
  wrap?: boolean;
  padding?: Json;
}
export const flex = (direction: "row" | "column", opts: FlexOpts = {}): Json => ({
  mode: "flex",
  direction,
  ...(opts.align ? { align: opts.align } : {}),
  ...(opts.justify ? { justify: opts.justify } : {}),
  ...(opts.gap !== undefined ? { gap: T(`space.${opts.gap}`) } : {}),
  ...(opts.wrap ? { wrap: true } : {}),
  ...(opts.padding ? { padding: opts.padding } : {}),
});

export interface Subtree {
  rootIds: string[];
  nodes: Record<string, Json>;
}

// Builder dengan ID unik ber-prefix + induk placeholder "tmp_parent" untuk root.
export class Tree {
  private seq = 0;
  readonly nodes: Record<string, Json> = {};
  constructor(private readonly prefix: string) {}

  id(): string {
    return `tmp_${this.prefix}${this.seq++}`;
  }

  add(node: Json & { id: string }): string {
    this.nodes[node.id] = node;
    return node.id;
  }

  frame(opts: {
    id?: string;
    name: string;
    parentId: string;
    children?: string[];
    layout?: Json;
    style?: Json;
    role?: string;
    tag?: string;
    props?: Json;
  }): string {
    const id = opts.id ?? this.id();
    const base: Json = { ...(opts.layout ? { layout: opts.layout } : {}), ...(opts.style ?? {}) };
    return this.add({
      id,
      type: "frame",
      name: opts.name,
      parentId: opts.parentId,
      visible: true,
      locked: false,
      children: opts.children ?? [],
      ...(opts.tag ? { tag: opts.tag } : {}),
      props: { ...(opts.role ? { role: opts.role } : {}), ...(opts.props ?? {}) },
      style: { base },
    });
  }

  text(opts: {
    id?: string;
    name: string;
    parentId: string;
    text: string;
    typography: string;
    color: string;
    tag?: string;
    width?: Json | typeof FILL | typeof HUG;
  }): string {
    const id = opts.id ?? this.id();
    return this.add({
      id,
      type: "text",
      name: opts.name,
      parentId: opts.parentId,
      visible: true,
      locked: false,
      ...(opts.tag ? { tag: opts.tag } : {}),
      props: { content: richText(opts.text) },
      style: {
        base: {
          size: size(opts.width ?? FILL, HUG),
          typography: T(opts.typography),
          color: T(opts.color),
        },
      },
    });
  }

  icon(opts: {
    id?: string;
    name: string;
    parentId: string;
    icon: string;
    set?: "lucide" | "brand";
    color: string;
    sizePx?: number;
  }): string {
    const id = opts.id ?? this.id();
    return this.add({
      id,
      type: "icon",
      name: opts.name,
      parentId: opts.parentId,
      visible: true,
      locked: false,
      props: { set: opts.set ?? "lucide", name: opts.icon },
      style: {
        base: {
          size: size(fixed(opts.sizePx ?? 24), fixed(opts.sizePx ?? 24)),
          color: T(opts.color),
        },
      },
    });
  }

  // Garis pembatas (shape line full-width).
  divider(opts: { id?: string; name: string; parentId: string; colorToken?: string }): string {
    const id = opts.id ?? this.id();
    return this.add({
      id,
      type: "shape",
      name: opts.name,
      parentId: opts.parentId,
      visible: true,
      locked: false,
      props: { shape: "line" },
      style: {
        base: {
          size: size(FILL, fixed(1)),
          fills: [{ type: "solid", color: T(opts.colorToken ?? "color.border") }],
        },
      },
    });
  }
}

// Tombol: frame role=button (flex row, padding, fill, radius) + label. `variant` menentukan fill/warna teks.
export type ButtonVariant = "primary" | "secondary" | "ghost" | "whatsapp";
export function button(
  tree: Tree,
  parentId: string,
  opts: {
    label: string;
    variant: ButtonVariant;
    icon?: string;
    iconSet?: "lucide" | "brand";
    sizeStep?: number;
    name?: string;
  },
): string {
  const padStep = opts.sizeStep ?? 3;
  const padX = padStep + 3;
  const fillToken =
    opts.variant === "primary"
      ? "color.primary"
      : opts.variant === "secondary"
        ? "color.surface"
        : opts.variant === "whatsapp"
          ? "color.success"
          : null; // ghost = transparan
  const textColor =
    opts.variant === "secondary" ? "color.onSurface" : opts.variant === "ghost" ? "color.primary" : "color.onPrimary";
  const style: Json = {
    size: size(HUG, HUG),
    radius: T("radius.md"),
    ...(fillToken ? { fills: [{ type: "solid", color: T(fillToken) }] } : {}),
    ...(opts.variant === "secondary"
      ? { strokes: [{ color: T("color.border"), width: { value: 1, unit: "px" } }] }
      : {}),
  };
  const btn = tree.frame({
    name: opts.name ?? "Button",
    parentId,
    role: "button",
    layout: flex("row", { align: "center", justify: "center", gap: 2, padding: padXY(padX, padStep) }),
    style,
  });
  const children: string[] = [];
  if (opts.icon)
    children.push(
      tree.icon({
        name: "ButtonIcon",
        parentId: btn,
        icon: opts.icon,
        set: opts.iconSet,
        color: textColor,
        sizePx: 18,
      }),
    );
  children.push(
    tree.text({
      name: "Label",
      parentId: btn,
      text: opts.label,
      typography: "typography.button",
      color: textColor,
      tag: "span",
      width: HUG,
    }),
  );
  (tree.nodes[btn] as { children: string[] }).children = children;
  return btn;
}

// Section penuh-lebar (CMP-003: root section width fill) dengan container ter-pusat (size.container) + padding vertikal.
export function section(
  tree: Tree,
  opts: {
    name: string;
    innerName?: string;
    padY?: number;
    gap?: number;
    align?: "start" | "center";
    surface?: boolean;
  },
): { root: string; inner: string } {
  const root = tree.frame({
    name: opts.name,
    parentId: "tmp_parent",
    role: "section",
    tag: "section",
    layout: flex("column", { align: "center", padding: padXY(6, opts.padY ?? 20) }),
    style: {
      size: size(FILL, HUG),
      ...(opts.surface ? { fills: [{ type: "solid", color: T("color.surface") }] } : {}),
    },
  });
  const inner = tree.frame({
    name: opts.innerName ?? "Container",
    parentId: root,
    layout: flex("column", { align: opts.align ?? "center", gap: opts.gap ?? 6 }),
    style: { size: { width: FILL, height: HUG, maxWidth: T("size.container") } },
  });
  (tree.nodes[root] as { children: string[] }).children = [inner];
  return { root, inner };
}

const setChildren = (tree: Tree, id: string, children: string[]): string => {
  (tree.nodes[id] as { children: string[] }).children = children;
  return id;
};

// Blok judul: eyebrow (overline) opsional + heading + lead (subteks) opsional. Rata kiri/tengah.
export function headingGroup(
  tree: Tree,
  parentId: string,
  opts: {
    eyebrow?: string;
    heading: string;
    lead?: string;
    headingTypography?: string;
    headingTag?: string;
    align?: "start" | "center";
    maxTextWidth?: number;
  },
): string {
  const group = tree.frame({
    name: "Heading",
    parentId,
    layout: flex("column", { align: opts.align ?? "center", gap: 3 }),
    style: {
      size: {
        width: FILL,
        height: HUG,
        ...(opts.maxTextWidth ? { maxWidth: { value: opts.maxTextWidth, unit: "px" } } : {}),
      },
    },
  });
  const kids: string[] = [];
  if (opts.eyebrow)
    kids.push(
      tree.text({
        name: "Eyebrow",
        parentId: group,
        text: opts.eyebrow,
        typography: "typography.overline",
        color: "color.primary",
        tag: "span",
        width: HUG,
      }),
    );
  kids.push(
    tree.text({
      name: "Title",
      parentId: group,
      text: opts.heading,
      typography: opts.headingTypography ?? "typography.h2",
      color: "color.onSurface",
      tag: opts.headingTag ?? "h2",
      width: FILL,
    }),
  );
  if (opts.lead)
    kids.push(
      tree.text({
        name: "Lead",
        parentId: group,
        text: opts.lead,
        typography: "typography.body",
        color: "color.muted",
        tag: "p",
        width: FILL,
      }),
    );
  return setChildren(tree, group, kids);
}

// Baris tombol (row, gap). Tombol dibuat lewat `button()`.
export function buttonRow(
  tree: Tree,
  parentId: string,
  buttons: string[],
  align: "start" | "center" = "center",
): string {
  const row = tree.frame({
    name: "Actions",
    parentId,
    layout: flex("row", { align: "center", justify: align, gap: 3, wrap: true }),
    style: { size: size(HUG, HUG) },
  });
  return setChildren(tree, row, buttons);
}

// Kartu bersurface (padding, radius lg, shadow sm). Kembalikan id; isi diisi caller lalu `setChildren`.
export function card(
  tree: Tree,
  parentId: string,
  opts: {
    name?: string;
    gap?: number;
    pad?: number;
    align?: "start" | "center";
    width?: Json | typeof FILL | typeof HUG;
  } = {},
): string {
  return tree.frame({
    name: opts.name ?? "Card",
    parentId,
    role: "card",
    layout: flex("column", { align: opts.align ?? "start", gap: opts.gap ?? 3, padding: padAll(opts.pad ?? 6) }),
    style: {
      size: size(opts.width ?? FILL, HUG),
      fills: [{ type: "solid", color: T("color.background") }],
      radius: T("radius.lg"),
      strokes: [{ color: T("color.border"), width: { value: 1, unit: "px" } }],
    },
  });
}

// Placeholder gambar (frame surface, aspect ratio). Konten default tak pakai aset berlisensi → aman tanpa manifest.
export function imageBox(
  tree: Tree,
  parentId: string,
  opts: { name?: string; aspect?: number; minHeight?: number } = {},
): string {
  return tree.frame({
    name: opts.name ?? "Image",
    parentId,
    role: "generic",
    style: {
      size: {
        width: FILL,
        height: HUG,
        ...(opts.aspect ? { aspectRatio: opts.aspect } : {}),
        ...(opts.minHeight ? { minHeight: { value: opts.minHeight, unit: "px" } } : {}),
      },
      fills: [{ type: "solid", color: T("color.surface") }],
      radius: T("radius.lg"),
    },
  });
}

// Input visual (placeholder) — frame border + teks muted. Konten default; fungsi form = DATA-* (follow-up).
export function inputBox(tree: Tree, parentId: string, placeholder: string): string {
  const box = tree.frame({
    name: "Input",
    parentId,
    layout: flex("row", { align: "center", padding: padXY(4, 3) }),
    style: {
      size: size(FILL, HUG),
      fills: [{ type: "solid", color: T("color.background") }],
      radius: T("radius.md"),
      strokes: [{ color: T("color.border"), width: { value: 1, unit: "px" } }],
    },
  });
  const t = tree.text({
    name: "Placeholder",
    parentId: box,
    text: placeholder,
    typography: "typography.body",
    color: "color.muted",
    tag: "span",
    width: FILL,
  });
  return setChildren(tree, box, [t]);
}

export { setChildren };

// ── File component lengkap ────────────────────────────────────────────────
export interface ComponentSpec {
  slug: string;
  kind: "element" | "block" | "section" | "layout";
  categorySlug: string;
  name: string;
  displayName: { id: string; en: string };
  description: { id: string; en: string };
  tags: string[];
  keywords: { id: string[]; en: string[] };
  aiHints: string;
  build: (tree: Tree) => string[]; // kembalikan rootIds
}

export function toComponentFile(spec: ComponentSpec): Json {
  const tree = new Tree(spec.slug.replace(/-/g, "").slice(0, 6));
  const rootIds = spec.build(tree);
  const id = `cmp_${spec.slug.replace(/-/g, "").slice(0, 24)}`;
  return {
    $schema: "../../../schema/component-seed.schema.json",
    seedVersion: 1,
    id,
    slug: spec.slug,
    kind: spec.kind,
    categorySlug: spec.categorySlug,
    meta: {
      name: spec.name,
      displayName: spec.displayName,
      description: spec.description,
      tags: spec.tags,
      keywords: spec.keywords,
      aiHints: spec.aiHints,
    },
    versions: [
      {
        version: "1.0.0",
        status: "published",
        changelog: { id: "Rilis awal.", en: "Initial release." },
        definition: { subtree: { rootIds, nodes: tree.nodes } },
      },
    ],
  };
}
