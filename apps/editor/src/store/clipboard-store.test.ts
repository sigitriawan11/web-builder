import { beforeEach, describe, expect, it } from "vitest";
import { breakpointStore } from "./breakpoint-store";
import { clipboardStore } from "./clipboard-store";

describe("clipboardStore", () => {
  beforeEach(() => clipboardStore.getState().clear());

  it("salinan baru mereset hitungan paste; notePaste menambah", () => {
    clipboardStore.getState().set({ payload: "{}", sourceSiteId: "s", origin: { x: 1, y: 2 }, copiedAt: 1 });
    clipboardStore.getState().notePaste();
    clipboardStore.getState().notePaste();
    expect(clipboardStore.getState().pasteCount).toBe(2);
    clipboardStore.getState().set({ payload: "[]", sourceSiteId: "s", origin: null, copiedAt: 2 });
    expect(clipboardStore.getState()).toMatchObject({ pasteCount: 0, entry: { payload: "[]" } });
  });

  it("state store hanya data serializable (bukan Y.Doc/objek hidup)", () => {
    clipboardStore.getState().set({ payload: "{}", sourceSiteId: "s", origin: null, copiedAt: 3 });
    const { set: _s, notePaste: _n, clear: _c, ...data } = clipboardStore.getState();
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });
});

describe("breakpointStore", () => {
  it("breakpoint aktif berganti; nilai sama tidak memicu update", () => {
    let updates = 0;
    const unsubscribe = breakpointStore.subscribe(() => updates++);
    breakpointStore.getState().setActive("tablet");
    breakpointStore.getState().setActive("tablet");
    expect(breakpointStore.getState().active).toBe("tablet");
    expect(updates).toBe(1);
    breakpointStore.getState().setActive("base");
    unsubscribe();
  });
});
