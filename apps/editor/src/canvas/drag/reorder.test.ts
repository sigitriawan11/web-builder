import { describe, expect, it } from "vitest";
import { type ChildBox, insertionMarker, reorderIndex } from "./reorder";

// Baris: tiga anak 100×50 dengan gap 20 mulai x=0.
const row: ChildBox[] = [0, 1, 2].map((i) => ({ id: `r${i}`, rect: { x: i * 120, y: 0, width: 100, height: 50 } }));
// Kolom: tiga anak 200×40 dengan gap 10 mulai y=0.
const column: ChildBox[] = [0, 1, 2].map((i) => ({ id: `c${i}`, rect: { x: 0, y: i * 50, width: 200, height: 40 } }));
// Wrap: 5 anak 100×50, 3 per baris, gap 12, crossGap 20.
const wrap: ChildBox[] = [0, 1, 2, 3, 4].map((i) => ({
  id: `w${i}`,
  rect: { x: (i % 3) * 112, y: Math.floor(i / 3) * 70, width: 100, height: 50 },
}));

describe("reorderIndex (ED-063)", () => {
  it.each([
    [{ x: -10, y: 25 }, 0],
    [{ x: 49, y: 25 }, 0],
    [{ x: 51, y: 25 }, 1],
    [{ x: 175, y: 25 }, 2],
    [{ x: 400, y: 25 }, 3],
  ])("baris: pointer %o → indeks %i", (pointer, expected) => {
    expect(reorderIndex(row, pointer, "row", false)).toBe(expected);
  });

  it.each([
    [{ x: 50, y: -5 }, 0],
    [{ x: 50, y: 30 }, 1],
    [{ x: 50, y: 95 }, 2],
    [{ x: 50, y: 500 }, 3],
  ])("kolom: pointer %o → indeks %i", (pointer, expected) => {
    expect(reorderIndex(column, pointer, "column", false)).toBe(expected);
  });

  it.each([
    [{ x: 5, y: 25 }, 0],
    [{ x: 200, y: 25 }, 2],
    [{ x: 330, y: 25 }, 3],
    [{ x: 5, y: 95 }, 3],
    [{ x: 170, y: 95 }, 5],
    [{ x: 60, y: 62 }, 4],
    [{ x: 300, y: 400 }, 5],
  ])("wrap: baris terdekat lalu kolom — pointer %o → indeks %i", (pointer, expected) => {
    expect(reorderIndex(wrap, pointer, "row", true)).toBe(expected);
  });

  it("container kosong → 0", () => {
    expect(reorderIndex([], { x: 10, y: 10 }, "row", true)).toBe(0);
  });
});

describe("insertionMarker (ED-063)", () => {
  const container = { x: -10, y: -10, width: 400, height: 200 };

  it("baris: garis vertikal di tengah celah, atau di tepi luar anak pertama/terakhir", () => {
    expect(insertionMarker(row, 1, "row", false, container)).toEqual({
      x: 110,
      y: -10,
      length: 200,
      orientation: "vertical",
    });
    expect(insertionMarker(row, 0, "row", false, container)).toMatchObject({ x: 0 });
    expect(insertionMarker(row, 3, "row", false, container)).toMatchObject({ x: 340 });
  });

  it("kolom: garis horizontal selebar container", () => {
    expect(insertionMarker(column, 2, "column", false, container)).toEqual({
      x: -10,
      y: 95,
      length: 400,
      orientation: "horizontal",
    });
  });

  it("wrap: garis setinggi baris tujuan; di akhir baris memakai baris anak sebelumnya", () => {
    expect(insertionMarker(wrap, 4, "row", true, container)).toEqual({
      x: 106,
      y: 70,
      length: 50,
      orientation: "vertical",
    });
    expect(insertionMarker(wrap, 3, "row", true, container)).toEqual({
      x: 324,
      y: 0,
      length: 50,
      orientation: "vertical",
    });
  });

  it("container kosong: di awal area container", () => {
    expect(insertionMarker([], 0, "column", false, container)).toMatchObject({ x: -10, y: -10 });
  });
});

describe("insertionMarker — ujung awal & akhir", () => {
  const container = { x: 0, y: 0, width: 300, height: 300 };

  it("kolom: sebelum anak pertama di tepi atasnya, setelah anak terakhir di tepi bawahnya", () => {
    expect(insertionMarker(column, 0, "column", false, container)).toMatchObject({ y: 0 });
    expect(insertionMarker(column, 3, "column", false, container)).toMatchObject({ y: 140 });
  });

  it("baris tanpa wrap: penanda setinggi container", () => {
    expect(insertionMarker(row, 2, "row", false, container)).toEqual({
      x: 230,
      y: 0,
      length: 300,
      orientation: "vertical",
    });
  });

  it("wrap kosong: di awal container", () => {
    expect(insertionMarker([], 0, "row", true, container)).toEqual({
      x: 0,
      y: 0,
      length: 300,
      orientation: "vertical",
    });
  });
});
