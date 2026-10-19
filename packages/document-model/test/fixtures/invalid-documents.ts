import type { SiteDocument } from "../../src/schema";
import { heroDocument } from "./basic-documents";

// AC DM-069: satu dokumen invalid per kode invariant (diturunkan dari heroDocument yang valid untuk publish).
// Disimpan sebagai `invalid/<CODE>.json` lewat file snapshot (`pnpm --filter @platform/document-model test -u`).

type Mutable = { nodes: Record<string, Record<string, unknown>> } & Record<string, unknown>;

function hero(mutate: (doc: Mutable, typed: SiteDocument) => void): unknown {
  const typed = heroDocument();
  const doc = JSON.parse(JSON.stringify(typed)) as Mutable;
  mutate(doc, typed);
  return doc;
}

const frame = (id: string, parentId: string, children: string[]) => ({
  id,
  type: "frame",
  name: id,
  parentId,
  children,
  visible: true,
  locked: false,
  style: { base: { layout: { mode: "flex", direction: "column" } } },
  props: {},
});

const children = (doc: Mutable, id: string) => doc.nodes[id]?.children as string[];

export const INVALID_DOCUMENTS = {
  SCHEMA: hero((doc) => {
    (doc.nodes.n_hero000001 as Record<string, unknown>).customCss = "color: red";
  }),
  DUPLICATE_ID: hero((doc) => {
    doc.nodes.n_copy0000001 = { ...doc.nodes.n_herottl001 };
  }),
  PARENT_MISSING: hero((doc) => {
    doc.nodes.n_herottl001 = { ...doc.nodes.n_herottl001, parentId: "n_hilang00001" };
    doc.nodes.n_hero000001 = { ...doc.nodes.n_hero000001, children: ["n_heroimg001"] };
  }),
  CHILD_MISMATCH: hero((doc) => {
    children(doc, "n_hero000001").push("n_tidakada001");
  }),
  CYCLE: hero((doc) => {
    doc.nodes.n_loopa000001 = frame("n_loopa000001", "n_loopb000001", ["n_loopb000001"]);
    doc.nodes.n_loopb000001 = frame("n_loopb000001", "n_loopa000001", ["n_loopa000001"]);
  }),
  ROOT_NOT_PAGE: hero((doc) => {
    doc.pageOrder = ["pg_home000001"];
  }),
  CONTAINER_TYPE: hero((doc) => {
    const title = doc.nodes.n_herottl001 as { style: { base: Record<string, unknown> } };
    title.style.base.layout = { mode: "flex", direction: "row" };
  }),
  HOME_PAGE: hero((doc) => {
    const about = doc.nodes.pg_about00001 as { props: Record<string, unknown> };
    about.props.isHome = true;
  }),
  DEPTH: hero((doc) => {
    // 33 frame bersarang di bawah hero (hero = level 1) → level 34 > 32.
    let parent = "n_hero000001";
    for (let level = 0; level < 33; level++) {
      const id = `n_deep${String(level).padStart(7, "0")}`;
      doc.nodes[id] = frame(id, parent, []);
      children(doc, parent).push(id);
      parent = id;
    }
  }),
  HTML_ID_DUPLICATE: hero((doc) => {
    doc.nodes.n_hero000001 = { ...doc.nodes.n_hero000001, htmlId: "promo" };
    doc.nodes.n_herottl001 = { ...doc.nodes.n_herottl001, htmlId: "promo" };
  }),
  PAGE_LAYOUT: hero((doc) => {
    const home = doc.nodes.pg_home000001 as { style: Record<string, unknown> };
    home.style.mobile = { layout: { direction: "row" } };
  }),
  SIZE_MODE: hero((doc) => {
    const image = doc.nodes.n_heroimg001 as { style: Record<string, unknown> };
    image.style.tablet = { size: { height: { mode: "hug" } } };
  }),
  LIMITS: hero((doc) => {
    // Teks > 20.000 karakter (DM-076 `textCharsPerNode`) — batas paling kecil untuk disimpan sebagai fixture.
    const title = doc.nodes.n_herottl001 as { props: Record<string, unknown> };
    title.props.content = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Kue enak. ".repeat(2_001) }] }],
    };
  }),
  ASSET_REF: hero((doc) => {
    doc.assets = {};
  }),
  ASSET_KIND: hero((doc) => {
    doc.assets = { ast_cake000001: { kind: "video", mime: "video/mp4" } };
  }),
  TOKEN_REF: hero((doc) => {
    const hero = doc.nodes.n_hero000001 as { style: { base: Record<string, unknown> } };
    hero.style.base.fills = [{ type: "solid", color: { $token: "color.tidakAda" } }];
  }),
  FONT_REF: hero((doc) => {
    const title = doc.nodes.n_herottl001 as { style: { base: Record<string, unknown> } };
    title.style.base.typography = { fontFamily: "Comic Sans MS" };
  }),
  BROKEN_LINK: hero((doc) => {
    const image = doc.nodes.n_heroimg001 as { props: Record<string, unknown> };
    image.props.link = { type: "page", pageId: "pg_dihapus001" };
  }),
  // DM-069: instance tanpa entri componentDeps.
  INSTANCE_DEP: hero((doc) => {
    doc.nodes.n_instdep001 = {
      id: "n_instdep001",
      type: "instance",
      name: "Instance",
      parentId: "n_hero000001",
      visible: true,
      locked: false,
      style: { base: {} },
      props: { componentId: "cmp_btn0001", version: 1 },
    };
    children(doc, "n_hero000001").push("n_instdep001");
  }),
} as const;
