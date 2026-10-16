import { describe, expect, it } from "vitest";
import { heroDocument } from "../../test/fixtures/basic-documents";
import { jsonToYDoc, SiteDocumentSchema, yDocToJson } from "../index";
import { deleteNodes, moveNode, renameNode, runCommand, setLocked, setVisible, updateStyle } from "./index";

const ORIGIN = { kind: "user", sessionId: "lock" } as const;
const [CARD, IMAGE] = ["n_hero000001", "n_heroimg001"];

function setup() {
  const doc = jsonToYDoc(heroDocument());
  const ctx = { doc, origin: ORIGIN };
  const read = () => SiteDocumentSchema.parse(yDocToJson(doc));
  const lock = (id: string, locked = true) => runCommand(ctx, setLocked, { ids: [id], locked });
  return { doc, ctx, read, lock };
}

describe("DM-075: command menolak node terkunci", () => {
  it("node terkunci → updateStyle/moveNode/rename/delete ditolak LOCKED; `force` melewati", () => {
    const { ctx, lock } = setup();
    expect(lock(CARD).ok).toBe(true);
    const style = runCommand(ctx, updateStyle, { ids: [CARD], patch: { radius: null } });
    expect(style).toMatchObject({ ok: false, error: { code: "LOCKED", details: { nodeId: CARD } } });
    expect(runCommand(ctx, renameNode, { id: CARD, name: "x" }).ok).toBe(false);
    expect(runCommand(ctx, deleteNodes, { ids: [CARD] }).ok).toBe(false);
    // force: true (UI dikonfirmasi) → berhasil.
    expect(runCommand({ ...ctx, force: true }, updateStyle, { ids: [CARD], patch: { radius: null } }).ok).toBe(true);
  });

  it("descendant node terkunci ikut terkunci (ancestor lock)", () => {
    const { ctx, lock, read } = setup();
    expect(lock(CARD).ok).toBe(true);
    // IMAGE adalah turunan CARD → juga terkunci.
    expect(read().nodes[IMAGE]?.parentId).toBe(CARD);
    expect(runCommand(ctx, updateStyle, { ids: [IMAGE], patch: { radius: null } }).ok).toBe(false);
  });

  it("setLocked & setVisible tetap boleh di node terkunci (membuka kunci / sembunyikan)", () => {
    const { ctx, lock } = setup();
    expect(lock(CARD).ok).toBe(true);
    // Buka kunci tanpa force.
    expect(runCommand(ctx, setLocked, { ids: [CARD], locked: false }).ok).toBe(true);
    // Kunci lagi, lalu setVisible diizinkan.
    expect(lock(CARD).ok).toBe(true);
    expect(runCommand(ctx, setVisible, { ids: [CARD], visible: false }).ok).toBe(true);
  });

  it("node tidak terkunci tetap bisa diubah", () => {
    const { ctx } = setup();
    expect(runCommand(ctx, moveNode, { id: IMAGE, newParentId: CARD, index: 0 }).ok).toBe(true);
  });
});
