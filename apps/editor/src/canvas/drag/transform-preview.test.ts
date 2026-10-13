// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { clearPreviewTranslate, setPreviewTranslate } from "./transform-preview";

describe("transform preview (ED-024)", () => {
  it("memasang & menghapus translate tanpa menyentuh transform milik node", () => {
    const element = document.createElement("div");
    element.style.transform = "rotate(10deg)";

    setPreviewTranslate(element, 12.5, -4);
    expect(element.style.translate).toBe("12.5px -4px");
    expect(element.style.transform).toBe("rotate(10deg)");

    clearPreviewTranslate(element);
    expect(element.style.translate).toBe("");
    expect(element.style.transform).toBe("rotate(10deg)");
  });
});
