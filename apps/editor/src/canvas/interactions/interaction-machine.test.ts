import { describe, expect, it } from "vitest";
import {
  DRAG_THRESHOLD_PX,
  IDLE,
  type InteractionEvent,
  type InteractionState,
  type PressTarget,
  reduceInteraction,
} from "./interaction-machine";

const ID = 1;
const OTHER = 2;
const origin = { x: 100, y: 100 };
const near = { x: 100 + DRAG_THRESHOLD_PX - 1, y: 100 };
const far = { x: 100 + DRAG_THRESHOLD_PX, y: 100 };
const end = { x: 160, y: 140 };

const node: PressTarget = { kind: "node", nodeId: "n_card000001", path: ["n_card000001", "pg_home000001"] };
const handle: PressTarget = { kind: "handle", nodeId: "n_card000001", handle: "se" };
const empty: PressTarget = { kind: "empty", scopeId: null, path: [] };

const down = (
  target: PressTarget,
  button = 0,
  panTool = false,
  pointerId = ID,
  modifiers: { additive?: boolean; deep?: boolean } = {},
): InteractionEvent => ({
  type: "pointerDown",
  pointerId,
  button,
  point: origin,
  target,
  panTool,
  additive: modifiers.additive ?? false,
  deep: modifiers.deep ?? false,
});
const move = (point: { x: number; y: number }, pointerId = ID): InteractionEvent => ({
  type: "pointerMove",
  pointerId,
  point,
});
const up = (point = end, pointerId = ID): InteractionEvent => ({ type: "pointerUp", pointerId, point });
const cancel = (pointerId = ID): InteractionEvent => ({ type: "pointerCancel", pointerId });

// Jalankan rangkaian event dari idle; kembalikan state akhir & semua efek.
function run(...events: InteractionEvent[]) {
  let state: InteractionState = IDLE;
  const effects = [];
  for (const event of events) {
    const transition = reduceInteraction(state, event);
    state = transition.state;
    effects.push(...transition.effects);
  }
  return { state, effects };
}

describe("reduceInteraction — dari idle (ED-023)", () => {
  it("tombol kiri → pressing dengan target", () => {
    expect(run(down(node)).state).toEqual({
      type: "pressing",
      pointerId: ID,
      origin,
      current: origin,
      shiftKey: false,
      target: node,
      additive: false,
      deep: false,
    });
  });

  it("tombol tengah atau hand tool → panning", () => {
    expect(run(down(node, 1)).state).toEqual({ type: "panning", pointerId: ID });
    expect(run(down(node, 0, true)).state).toEqual({ type: "panning", pointerId: ID });
  });

  it("tombol kanan diabaikan (context menu)", () => {
    expect(run(down(node, 2)).state).toBe(IDLE);
  });
});

describe("reduceInteraction — pressing", () => {
  it("bergerak di bawah threshold tetap pressing; lepas = click tanpa drag", () => {
    const { state, effects } = run(down(node), move(near), up(near));

    expect(state).toBe(IDLE);
    expect(effects).toEqual([{ type: "click", target: node, point: near, additive: false, deep: false }]);
  });

  it.each([
    [node, "dragMove"],
    [handle, "dragResize"],
    [empty, "marquee"],
  ] as const)("melewati threshold di atas %o → %s", (target, expected) => {
    const { state } = run(down(target), move(far));

    expect(state.type).toBe(expected);
    expect(state).toMatchObject({ pointerId: ID, origin, current: far });
  });

  it("marquee membawa scope frame awal & mode tambah (Shift)", () => {
    const scoped: PressTarget = { kind: "empty", scopeId: "n_hero000001", path: ["n_hero000001", "pg_home000001"] };
    const shiftDown: InteractionEvent = { ...down(scoped), additive: true } as InteractionEvent;

    expect(run(shiftDown, move(far)).state).toMatchObject({ type: "marquee", scopeId: "n_hero000001", additive: true });
  });

  it("dragResize membawa node & handle", () => {
    expect(run(down(handle), move(far)).state).toMatchObject({
      type: "dragResize",
      nodeId: "n_card000001",
      handle: "se",
    });
  });

  it.each([
    ["Esc", { type: "escape" } as const],
    ["pointercancel", cancel()],
    ["blur", { type: "blur" } as const],
  ])("%s membatalkan klik tanpa efek", (_, event) => {
    expect(run(down(node), event)).toEqual({ state: IDLE, effects: [] });
  });
});

describe("reduceInteraction — drag", () => {
  it.each([node, handle, empty])("drag dari %o: lepas = commit dengan titik akhir", (target) => {
    const { state, effects } = run(down(target), move(far), up(end));

    expect(state).toBe(IDLE);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ type: "commit", drag: { origin, current: end } });
  });

  it("Shift saat bergerak dicatat di state drag (kunci sumbu ED-062)", () => {
    const shifted = { type: "pointerMove", pointerId: ID, point: end, shiftKey: true } as const;
    expect(run(down(node), move(far), shifted).state).toMatchObject({
      type: "dragMove",
      shiftKey: true,
      path: node.kind === "node" ? node.path : [],
    });
  });

  it("pointermove memperbarui posisi terkini", () => {
    expect(run(down(node), move(far), move(end)).state).toMatchObject({ type: "dragMove", current: end });
  });

  it.each([
    ["Esc", { type: "escape" } as const],
    ["pointercancel", cancel()],
    ["blur", { type: "blur" } as const],
  ])("%s membatalkan drag (efek cancel, tanpa commit)", (_, event) => {
    const { state, effects } = run(down(node), move(far), event);

    expect(state).toBe(IDLE);
    expect(effects).toEqual([{ type: "cancel", drag: expect.objectContaining({ type: "dragMove", current: far }) }]);
  });
});

describe("reduceInteraction — panning", () => {
  it("lepas atau pointercancel kembali ke idle tanpa efek; Esc tidak menghentikan pan", () => {
    expect(run(down(node, 1), up())).toEqual({ state: IDLE, effects: [] });
    expect(run(down(node, 1), cancel())).toEqual({ state: IDLE, effects: [] });
    expect(run(down(node, 1), { type: "escape" }).state).toEqual({ type: "panning", pointerId: ID });
  });

  it("pointermove tidak memulai drag selama pan", () => {
    expect(run(down(node, 1), move(far)).state).toEqual({ type: "panning", pointerId: ID });
  });
});

describe("reduceInteraction — event tidak valid diabaikan tanpa error", () => {
  const states: InteractionState[] = [
    IDLE,
    run(down(node)).state,
    run(down(handle)).state,
    run(down(empty)).state,
    run(down(node), move(far)).state,
    run(down(handle), move(far)).state,
    run(down(empty), move(far)).state,
    run(down(node, 1)).state,
  ];
  const otherPointerEvents: InteractionEvent[] = [move(end, OTHER), up(end, OTHER), cancel(OTHER)];
  const allEvents: InteractionEvent[] = [
    down(node),
    down(node, 1),
    down(node, 2),
    move(near),
    move(far),
    up(),
    cancel(),
    { type: "escape" },
    { type: "blur" },
    ...otherPointerEvents,
  ];

  it("semua kombinasi state × event tidak melempar error dan selalu menghasilkan state valid", () => {
    for (const state of states) {
      for (const event of allEvents) {
        const transition = reduceInteraction(state, event);
        expect(transition.state.type).toMatch(/^(idle|pressing|dragMove|dragResize|marquee|panning)$/);
        expect(Array.isArray(transition.effects)).toBe(true);
      }
    }
  });

  it("event dari pointer lain tidak mengubah state apa pun", () => {
    for (const state of states) {
      for (const event of otherPointerEvents) {
        expect(reduceInteraction(state, event)).toEqual({ state, effects: [] });
      }
    }
  });

  it("pointerdown kedua saat interaksi berjalan diabaikan (mis. jari kedua)", () => {
    for (const state of states.filter((s) => s.type !== "idle")) {
      expect(reduceInteraction(state, down(empty, 0, false, OTHER))).toEqual({ state, effects: [] });
    }
  });

  it("pointerup/cancel/Esc di idle tidak berbuat apa-apa", () => {
    for (const event of [up(), cancel(), { type: "escape" } as const, { type: "blur" } as const, move(far)]) {
      expect(reduceInteraction(IDLE, event)).toEqual({ state: IDLE, effects: [] });
    }
  });
});
