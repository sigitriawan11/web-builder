import {
  createNode,
  jsonToYDoc,
  runCommand,
  SiteDocumentSchema,
  YDOC_KEYS,
  yDocToJson,
} from "@platform/document-model";
import { heroDocument } from "@platform/document-model/fixtures";
import { describe, expect, it } from "vitest";
import { createUndoController } from "../../document/undo-controller";
import { addPage, duplicatePage, movePage, pageSubtree, removePage, renamePage, setHomePage } from "./page-actions";

const ORIGIN = { kind: "user", sessionId: "pages" } as const;

function setup() {
  const doc = jsonToYDoc(heroDocument());
  const undo = createUndoController(doc, [ORIGIN], { get: () => [], restore: () => {}, exists: () => true });
  const context = { doc, origin: ORIGIN, undoBoundary: () => undo.stopCapturing() };
  const read = () => SiteDocumentSchema.parse(yDocToJson(doc));
  const order = () => doc.getArray<string>(YDOC_KEYS.pageOrder).toArray();
  return { doc, undo, context, read, order };
}

describe("aksi Pages panel (ED-032)", () => {
  it("tambah page: path unik dari judul; undo menghapusnya (AC CRUD + undo)", () => {
    const { context, read, undo, order } = setup();
    const before = order().length;
    const id = addPage(context, "Tentang Kami");
    expect(id).toBeTruthy();
    expect(read().nodes[id as string]).toMatchObject({
      type: "page",
      props: { title: "Tentang Kami", path: "/tentang-kami" },
    });
    const second = addPage(context, "Tentang Kami");
    expect(read().nodes[second as string]?.type === "page" && read().nodes[second as string]).toMatchObject({
      props: { path: "/tentang-kami-2" },
    });
    undo.undo();
    undo.undo();
    expect(order()).toHaveLength(before);
  });

  it("duplikat page menyalin isi (ID baru) tepat setelah aslinya; satu langkah undo", () => {
    const { doc, context, read, undo, order } = setup();
    const [home] = order();
    runCommand({ doc, origin: ORIGIN }, createNode, { parentId: home as string, type: "text" });
    undo.stopCapturing();
    const originalCount = pageSubtree(doc, home as string);
    const copy = duplicatePage(context, home as string, (title) => `${title} (salinan)`);
    expect(copy).toBeTruthy();
    expect(order().indexOf(copy as string)).toBe(order().indexOf(home as string) + 1);
    const copied = pageSubtree(doc, copy as string);
    expect(Object.keys(copied?.nodes ?? {})).toHaveLength(Object.keys(originalCount?.nodes ?? {}).length);
    // ID baru (bukan berbagi node dengan aslinya).
    for (const id of Object.keys(copied?.nodes ?? {})) expect(originalCount?.nodes[id]).toBeUndefined();
    const page = read().nodes[copy as string];
    expect(page?.type === "page" && page.props.isHome).toBe(false);
    undo.undo();
    expect(order()).not.toContain(copy);
  });

  it("rename, set home (path bertukar), hapus (home dilindungi), reorder", () => {
    const { context, read, order } = setup();
    const [home] = order();
    const about = addPage(context, "Tentang") as string;
    expect(renamePage(context, about, "  Profil  ")).toBe(true);
    expect(renamePage(context, about, "   ")).toBe(false);
    const aboutNode = read().nodes[about];
    expect(aboutNode?.type === "page" && aboutNode.props.title).toBe("Profil");

    expect(removePage(context, home as string)).toBe(false);
    expect(setHomePage(context, about)).toBe(true);
    const now = read().nodes[about];
    expect(now?.type === "page" && now.props).toMatchObject({ isHome: true, path: "/" });
    expect(removePage(context, home as string)).toBe(true);
    expect(order()).not.toContain(home);

    const extra = addPage(context, "Kontak") as string;
    // reorderPages = permutasi lengkap (fixture punya page lain juga).
    const reordered = [extra, ...order().filter((id) => id !== extra)];
    expect(movePage(context, reordered)).toBe(true);
    expect(order()).toEqual(reordered);
    expect(movePage(context, [extra])).toBe(false);
  });
});
