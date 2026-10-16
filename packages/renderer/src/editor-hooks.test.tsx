import type { Node, SiteDocument } from "@platform/document-model";
import { heroDocument, richTextDocument } from "@platform/document-model/fixtures";
import { Fragment, memo, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RenderContext } from "./context";
import { anchorTargets } from "./links";
import { childRenderEnv, type RenderEnv, render, renderNodeElement } from "./render";

// T1.10.9 / ED-017 / ED-018: hook mode editor lewat props — editor merender per node (inkremental) memakai fungsi
// renderer yang sama, tanpa renderer mengenal API editor.

const assetUrl = (assetId: string) => `/uploads/${assetId}`;
const editorCtx = (overrides: Partial<RenderContext> = {}): RenderContext => ({
  pageId: "pg_home000001",
  breakpoint: "base",
  mode: "editor",
  assetUrl,
  nodeAttributes: (node) => ({ "data-node-id": node.id }),
  ...overrides,
});

/** Simulasi NodeView editor: lookup per node (seperti snapshot Y.Map), satu komponen memo per node. */
function editorTree(doc: SiteDocument, ctx: RenderContext, textOverride?: Record<string, ReactNode>) {
  const nodes = new Map(Object.entries(doc.nodes));
  const anchors = anchorTargets(doc);
  const rootEnv: RenderEnv = {
    ctx,
    node: (id) => nodes.get(id),
    asset: (id) => doc.assets[id],
    isAnchorTarget: (id) => anchors.has(id),
    insideLink: false,
  };
  const NodeView = memo(function NodeViewRender({ id, env }: { id: string; env: RenderEnv }): ReactElement | null {
    const node = env.node(id) as Node | undefined;
    if (!node) return null;
    const childEnv = childRenderEnv(node, env);
    const children =
      "children" in node
        ? node.children.map((childId) => <NodeView key={childId} id={childId} env={childEnv} />)
        : null;
    const content = textOverride?.[id];
    return renderNodeElement(node, env, children, content !== undefined ? { content } : {});
  });
  return <NodeView id={ctx.pageId} env={rootEnv} />;
}

describe("render per node (inkremental) = render() pohon penuh", () => {
  it.each([
    ["hero", heroDocument],
    ["rich-text", richTextDocument],
  ])("%s", (_, create) => {
    const doc = create();
    expect(renderToStaticMarkup(editorTree(doc, editorCtx()))).toBe(renderToStaticMarkup(render(doc, editorCtx())));
  });

  it("frame berlink: anak inkremental juga tanpa <a> bersarang (childRenderEnv)", () => {
    const doc = heroDocument();
    const hero = doc.nodes.n_hero000001;
    const image = doc.nodes.n_heroimg001;
    if (hero?.type !== "frame" || image?.type !== "image") throw new Error("fixture berubah");
    hero.props.link = { type: "page", pageId: "pg_about00001" };
    image.props.link = { type: "url", href: "https://contoh.id" };
    const html = renderToStaticMarkup(editorTree(doc, editorCtx()));
    expect(html).toBe(renderToStaticMarkup(render(doc, editorCtx())));
    expect(html.match(/<a /g)).toHaveLength(1);
  });
});

describe("hook editor", () => {
  it("isi teks bisa diganti editor teks inline; atribut node tetap", () => {
    const html = renderToStaticMarkup(
      editorTree(heroDocument(), editorCtx(), { n_herottl001: <span data-inline-editor="">sedang diedit</span> }),
    );
    expect(html).toMatch(
      /<h1 data-node-id="n_herottl001" style="text-align:center"><span data-inline-editor="">sedang diedit<\/span><\/h1>/,
    );
  });

  it("ref geometry editor diteruskan ke elemen node lewat nodeAttributes", () => {
    const ref = () => undefined;
    const doc = heroDocument();
    const element = renderNodeElement(
      doc.nodes.n_hero000001 as Node,
      {
        ctx: editorCtx({ nodeAttributes: (node) => ({ "data-node-id": node.id, ref }) }),
        node: (id) => doc.nodes[id],
        asset: (id) => doc.assets[id],
        isAnchorTarget: () => false,
        insideLink: false,
      },
      <Fragment />,
    );
    if (!element) throw new Error("elemen hero tidak dirender");
    expect((element.props as { attributes: Record<string, unknown> }).attributes).toMatchObject({
      "data-node-id": "n_hero000001",
      ref,
    });
  });

  it("style inline dari nodeAttributes digabung dengan style milik teks & gambar (tidak saling menimpa)", () => {
    const doc = heroDocument();
    const withFocal = {
      ...doc.nodes.n_heroimg001,
      props: { ...(doc.nodes.n_heroimg001 as Extract<Node, { type: "image" }>).props },
    } as Extract<Node, { type: "image" }>;
    withFocal.props.image = { ...withFocal.props.image, focalPoint: { x: 0.25, y: 0.75 } };
    doc.nodes.n_heroimg001 = withFocal;
    const html = renderToStaticMarkup(
      render(doc, editorCtx({ nodeAttributes: (node) => ({ "data-node-id": node.id, style: { color: "red" } }) })),
    );
    expect(html).toMatch(/<h1 data-node-id="n_herottl001" style="color:red;text-align:center">/);
    expect(html).toMatch(/<img data-node-id="n_heroimg001" [^>]*style="color:red;object-position:25% 75%"/);
  });

  it("visible:false di publish → null", () => {
    const doc = heroDocument();
    const image = doc.nodes.n_heroimg001 as Node;
    const env: RenderEnv = {
      ctx: editorCtx({ mode: "publish" }),
      node: () => undefined,
      asset: () => undefined,
      isAnchorTarget: () => false,
      insideLink: false,
    };
    expect(renderNodeElement({ ...image, visible: false }, env, null)).toBeNull();
  });
});
