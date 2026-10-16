// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MIXED } from "../mixed";
import { NumberInput, type NumberUpdate } from "./NumberInput";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function mount(value: number | typeof MIXED | undefined, extra: Partial<Parameters<typeof NumberInput>[0]> = {}) {
  const updates: NumberUpdate[] = [];
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <NumberInput
        label="Width"
        scrubLabel="W"
        value={value}
        onCommit={(update) => updates.push(update)}
        testId="w"
        {...extra}
      />,
    ),
  );
  cleanups.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  const input = container.querySelector("input") as HTMLInputElement;
  const type = (text: string) =>
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  const key = (key: string, init: KeyboardEventInit = {}) =>
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
    });
  return { input, updates, type, key, container };
}

describe("NumberInput (ED-070)", () => {
  it("ekspresi + Enter → commit; relatif dihitung dari nilai node", () => {
    const { type, key, updates } = mount(300);
    type("100+20");
    key("Enter");
    expect(updates[0]?.(300)).toBe(120);
    type("/2");
    key("Enter");
    // Multi-seleksi: fungsi diterapkan per node.
    expect(updates[1]?.(300)).toBe(150);
    expect(updates[1]?.(80)).toBe(40);
  });

  it("invalid → tidak commit, aria-invalid, nilai kembali", () => {
    vi.useFakeTimers();
    const { input, type, key, updates } = mount(300);
    type("10++");
    key("Enter");
    expect(updates).toHaveLength(0);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.value).toBe("300");
    act(() => vi.advanceTimersByTime(700));
    expect(input.getAttribute("aria-invalid")).toBeNull();
    vi.useRealTimers();
  });

  it("↑/↓ ±1, Shift ±10; Escape membatalkan; batas min", () => {
    const { type, key, updates, input } = mount(5, { min: 0 });
    key("ArrowUp");
    key("ArrowDown", { shiftKey: true });
    expect(updates[0]?.(5)).toBe(6);
    expect(updates[1]?.(5)).toBe(0);
    type("999");
    key("Escape");
    expect(updates).toHaveLength(2);
    expect(input.value).toBe("5");
  });

  it("Mixed: placeholder; nilai absolut sama untuk semua, relatif per node", () => {
    const { input, type, key, updates } = mount(MIXED);
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("Campuran");
    type("+10");
    key("Enter");
    expect([updates[0]?.(1), updates[0]?.(50)]).toEqual([11, 60]);
    type("24");
    key("Enter");
    expect([updates[1]?.(1), updates[1]?.(50)]).toEqual([24, 24]);
  });

  it("kata kunci (auto/hug/fill) diteruskan ke pemanggil", () => {
    const onKeyword = vi.fn(() => true);
    const { type, key, updates } = mount(100, { onKeyword });
    type("Hug");
    key("Enter");
    expect(onKeyword).toHaveBeenCalledWith("hug");
    expect(updates).toHaveLength(0);
  });

  it("scrub label: geser 3 px → +3; Shift ×10", () => {
    const { container, updates } = mount(10);
    const label = container.querySelector('[data-testid="w-scrub"]') as HTMLElement;
    label.setPointerCapture = () => {};
    act(() => {
      label.dispatchEvent(new PointerEvent("pointerdown", { clientX: 100, bubbles: true, pointerId: 1 }));
      label.dispatchEvent(new PointerEvent("pointermove", { clientX: 103, bubbles: true, pointerId: 1 }));
      label.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 104, bubbles: true, shiftKey: true, pointerId: 1 }),
      );
      label.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    });
    expect(updates[0]?.(10)).toBe(13);
    expect(updates[1]?.(10)).toBe(20);
  });
});
