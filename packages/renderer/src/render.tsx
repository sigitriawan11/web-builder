import {
  type AssetEntry,
  type LinkValue,
  type Node,
  type ResolveCtx,
  type ResolvedNode,
  resolveInstance,
  type SiteDocument,
} from "@platform/document-model";
import { Fragment, type ReactElement, type ReactNode } from "react";
import type { RenderContext } from "./context";
import { anchorId, anchorTargets, linkAttributes } from "./links";
import { Box, Image, Link, Text } from "./primitives";
import { renderRichText } from "./rich-text";

// DM-001: dokumen → React murni (tanpa I/O, tanpa state global); output sama untuk input sama.
// ED-017/ED-018: editor merender INKREMENTAL (satu NodeView per node yang berlangganan Y.Map-nya), jadi renderer
// menyediakan render per node (`renderNodeElement`) + lingkungan (`RenderEnv`) yang diisi lookup — bukan dokumen JSON
// penuh. `render()` (publish/SSR) dibangun dari fungsi yang sama sehingga kedua mode tidak bisa menyimpang.

const DEFAULT_TAG: Record<Node["type"], string> = {
  page: "main",
  frame: "div",
  text: "p",
  image: "img",
  shape: "div",
  icon: "span",
  group: "div",
  // Placeholder; tag efektif instance = root component setelah resolusi (T3.2.1).
  instance: "div",
};

export interface RenderEnv {
  ctx: RenderContext;
  node: (id: string) => Node | undefined;
  asset: (id: string) => AssetEntry | undefined;
  // Node yang menjadi target anchor link (butuh atribut `id`).
  isAnchorTarget: (id: string) => boolean;
  // DM-009: di dalam <a> (frame berlink) tidak boleh ada elemen interaktif lain → link dalam dirender tanpa <a>.
  insideLink: boolean;
}

/** Lingkungan render dari dokumen JSON (publish/SSR, test). Editor membuat `RenderEnv` sendiri dari Y.Doc. */
export function createRenderEnv(doc: SiteDocument, ctx: RenderContext): RenderEnv {
  const anchors = anchorTargets(doc);
  return {
    ctx,
    node: (id) => doc.nodes[id],
    asset: (id) => doc.assets[id],
    isAnchorTarget: (id) => anchors.has(id),
    insideLink: false,
  };
}

function baseAttributes(node: Node, env: RenderEnv): Record<string, unknown> {
  const { ctx } = env;
  const className = ctx.className?.(node);
  const a11y = node.a11y;
  const needsId = node.htmlId !== undefined || env.isAnchorTarget(node.id);
  return {
    // `metadata` (editor/AI) sengaja tidak pernah dirender (DM-008).
    ...(needsId ? { id: anchorId(env.node, node.id) } : {}),
    ...(className ? { className } : {}),
    ...(a11y?.label ? { "aria-label": a11y.label } : {}),
    ...(a11y?.role ? { role: a11y.role } : {}),
    ...(a11y?.hiddenFromScreenReader ? { "aria-hidden": true } : {}),
    // DM-039: `visible: false` tidak dipublish; di editor tetap ada (disembunyikan) agar bisa dipilih dari layer panel.
    ...(!node.visible ? { hidden: true } : {}),
    // Hook mode editor (T1.10.9): `data-node-id`, ref geometry, dsb. — renderer tidak tahu API editor.
    ...ctx.nodeAttributes?.(node),
  };
}

// Atribut <a>; di dalam link lain → null (tanpa <a>, DM-009).
function linkOf(value: LinkValue, env: RenderEnv): Record<string, unknown> | null {
  return env.insideLink ? null : { ...linkAttributes(value, env.node, env.ctx) };
}

/** Lingkungan untuk anak-anak `node` (frame berlink → anak di dalam link). */
export function childRenderEnv(node: Node, env: RenderEnv): RenderEnv {
  const opensLink = node.type === "frame" && node.props.link !== undefined && !env.insideLink;
  return opensLink ? { ...env, insideLink: true } : env;
}

export interface RenderNodeOptions {
  // Pengganti isi node teks (editor teks inline ED-115 menggantikan hasil render rich text).
  content?: ReactNode;
  // Override tag elemen node teks (editor-only): saat edit inline, ProseMirror membungkus isi dalam `<div>`;
  // membungkusnya di `<p>`/`<hN>` = nesting HTML tak valid (warning React). Editor pakai `div` saat editing.
  tag?: string;
  // DM-051: root hasil resolve instance membawa `data-instance-id` (editor: klik → pilih instance).
  instanceId?: string;
}

/**
 * Elemen satu node; `children` = anak yang sudah dirender pemanggil dengan `childRenderEnv(node, env)`.
 * `null` bila node tidak dirender (mis. `visible: false` di publish).
 */
export function renderNodeElement(
  node: Node,
  env: RenderEnv,
  children: ReactNode,
  options: RenderNodeOptions = {},
): ReactElement | null {
  const { ctx } = env;
  if (!node.visible && ctx.mode === "publish") return null;
  const attributes = baseAttributes(node, env);
  // DM-051: penanda instance di mode editor (seleksi). Publish tidak membawanya.
  if (options.instanceId && ctx.mode === "editor") attributes["data-instance-id"] = options.instanceId;

  switch (node.type) {
    case "page":
      return (
        <Box tag={node.tag ?? DEFAULT_TAG.page} attributes={attributes}>
          {children}
        </Box>
      );
    case "frame": {
      // DM-011: frame berlink (card/tombol) dirender sebagai <a>.
      const frameLink = node.props.link ? linkOf(node.props.link, env) : null;
      if (frameLink) return <Link attributes={{ ...attributes, ...frameLink }}>{children}</Link>;
      return (
        <Box tag={node.tag ?? DEFAULT_TAG.frame} attributes={attributes}>
          {children}
        </Box>
      );
    }
    case "group": {
      // DM-012: group = div non-semantik, bounding box dari style (posisi absolute + size); anak absolute relatif ke
      // group. Tanpa fills/layout; containing block dari position absolute pada style.
      return (
        <Box tag={node.tag ?? DEFAULT_TAG.group} attributes={attributes}>
          {children}
        </Box>
      );
    }
    case "text": {
      const { content, style } = renderRichText(node.props.content, (value) => linkOf(value, env));
      return (
        <Text tag={options.tag ?? node.tag ?? DEFAULT_TAG.text} attributes={attributes} style={style}>
          {options.content ?? content}
        </Text>
      );
    }
    case "image": {
      const { image, decorative, loading, link: imageLink } = node.props;
      const entry = env.asset(image.assetId);
      const focal = image.focalPoint;
      // Link gambar di dalam link lain → tanpa <a>; atribut node tetap di <img> (DM-009).
      const imageAttributes = imageLink ? linkOf(imageLink, env) : null;
      const element = (
        <Image
          attributes={imageAttributes ? {} : attributes}
          src={ctx.assetUrl(image.assetId)}
          alt={decorative ? "" : (image.alt ?? "")}
          width={entry?.width}
          height={entry?.height}
          loading={loading ?? "lazy"}
          objectPosition={focal ? `${focal.x * 100}% ${focal.y * 100}%` : undefined}
        />
      );
      return imageAttributes ? <Link attributes={{ ...attributes, ...imageAttributes }}>{element}</Link> : element;
    }
    case "shape": {
      // DM-016: rect/ellipse = <div> + CSS (fills/strokes/radius/border-radius). Line (P1) = SVG — sampai itu div.
      const shapeLink = node.props.link ? linkOf(node.props.link, env) : null;
      if (shapeLink) return <Link attributes={{ ...attributes, ...shapeLink }}>{null}</Link>;
      return <Box tag={node.tag ?? DEFAULT_TAG.shape} attributes={attributes} />;
    }
    case "icon": {
      // DM-015: ikon Lucide sebagai inline SVG. Definisi path diambil dari peta ikon renderer (ctx.icon); bila tak
      // tersedia (mis. editor menyuntik SVG sendiri lewat `content`), render kosong.
      const svg = options.content ?? ctx.icon?.(node.props.name, node.props.strokeWidth, node.props.set);
      const iconLink = node.props.link ? linkOf(node.props.link, env) : null;
      const span = (
        <Box tag={node.tag ?? DEFAULT_TAG.icon} attributes={iconLink ? {} : attributes}>
          {svg ?? null}
        </Box>
      );
      return iconLink ? <Link attributes={{ ...attributes, ...iconLink }}>{span}</Link> : span;
    }
    case "instance": {
      // DM-051: resolve ComponentDefinition@version → render subtree hasil. Tanpa registry (`ctx.component`) atau
      // component/versi hilang → placeholder (halaman tidak crash).
      if (!ctx.component) return <Box tag={DEFAULT_TAG.instance} attributes={attributes} />;
      const resolveCtx: ResolveCtx = { getComponent: ctx.component, siteNode: env.node };
      const resolved = resolveInstance(node, resolveCtx);
      if (resolved.missingComponent) {
        const label = `${resolved.missingComponent.componentId}@${resolved.missingComponent.version}`;
        return <Box tag={DEFAULT_TAG.instance} attributes={{ ...attributes, "data-missing-component": label }} />;
      }
      return renderResolvedTree(resolved, env, true);
    }
  }
}

/** Render subtree hasil resolve instance (ResolvedNode = Node-like dengan anak inline). Root membawa data-instance-id. */
function renderResolvedTree(resolved: ResolvedNode, env: RenderEnv, isRoot: boolean): ReactElement | null {
  if (!resolved.visible && env.ctx.mode === "publish") return null;
  const opensLink =
    resolved.type === "frame" && !env.insideLink && (resolved.props as { link?: unknown })?.link != null;
  const childEnv = opensLink ? { ...env, insideLink: true } : env;
  const children = resolved.children?.length
    ? resolved.children.map((child) => <Fragment key={child.id}>{renderResolvedTree(child, childEnv, false)}</Fragment>)
    : null;
  return renderNodeElement(
    resolved as unknown as Node,
    env,
    children,
    isRoot && resolved.sourceInstanceId ? { instanceId: resolved.sourceInstanceId } : {},
  );
}

function renderTree(id: string, env: RenderEnv): ReactNode {
  const node = env.node(id);
  if (!node) return null;
  const childEnv = childRenderEnv(node, env);
  const children =
    "children" in node
      ? node.children.map((childId) => <Fragment key={childId}>{renderTree(childId, childEnv)}</Fragment>)
      : null;
  return renderNodeElement(node, env, children);
}

/** Render satu page dokumen (DM-001). `null` bila `ctx.pageId` bukan page di dokumen. */
export function render(doc: SiteDocument, ctx: RenderContext): ReactElement | null {
  const page = doc.nodes[ctx.pageId];
  if (page?.type !== "page") return null;
  return <>{renderTree(ctx.pageId, createRenderEnv(doc, ctx))}</>;
}
