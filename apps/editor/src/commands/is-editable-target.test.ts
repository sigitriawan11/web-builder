// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isEditableEvent, isEditableTarget } from "./is-editable-target";

describe("isEditableTarget", () => {
  it.each([
    [{ tagName: "INPUT" }, true],
    [{ tagName: "textarea" }, true],
    [{ tagName: "SELECT" }, true],
    [{ tagName: "DIV", isContentEditable: true }, true],
    [{ tagName: "DIV", isContentEditable: false }, false],
    [{ tagName: "MAIN" }, false],
    [null, false],
  ])("%o → %s", (target, expected) => {
    expect(isEditableTarget(target)).toBe(expected);
  });
});

describe("isEditableEvent (temuan T0.4.5)", () => {
  // Input di dalam shadow root (isolasi canvas Opsi A); event ditangkap di window seperti shortcut editor.
  // Dibaca DI DALAM listener: setelah dispatch selesai, composedPath() dikosongkan.
  function keydownAtWindow(build: (root: ShadowRoot) => HTMLElement) {
    const host = document.createElement("div");
    document.body.append(host);
    const target = build(host.attachShadow({ mode: "open" }));
    let seen: { retargeted: boolean; editable: boolean } | null = null;
    const listener = (event: KeyboardEvent) => {
      seen = { retargeted: event.target === host, editable: isEditableEvent(event) };
    };
    window.addEventListener("keydown", listener);
    target.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, composed: true }));
    window.removeEventListener("keydown", listener);
    host.remove();
    if (!seen) throw new Error("event tidak sampai ke window");
    return seen as { retargeted: boolean; editable: boolean };
  }

  it("membaca target asli lewat composedPath walau event.target di-retarget ke host shadow", () => {
    expect(keydownAtWindow((root) => root.appendChild(document.createElement("input")))).toEqual({
      retargeted: true,
      editable: true,
    });
  });

  it("event yang berasal dari document (bukan elemen) → false", () => {
    let editable: boolean | null = null;
    const listener = (event: KeyboardEvent) => {
      editable = isEditableEvent(event);
    };
    window.addEventListener("keydown", listener);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "v", bubbles: true }));
    window.removeEventListener("keydown", listener);

    expect(editable).toBe(false);
  });

  it("elemen bukan input di shadow root → false", () => {
    expect(keydownAtWindow((root) => root.appendChild(document.createElement("div"))).editable).toBe(false);
  });
});
