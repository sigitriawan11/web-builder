import { describe, expect, it } from "vitest";
import { type ChildRect, inferAutoLayout, type Rect } from "./infer";

const frame: Rect = { x: 0, y: 0, width: 300, height: 300 };
const child = (id: string, x: number, y: number, w = 40, h = 20): ChildRect => ({
  id,
  rect: { x, y, width: w, height: h },
});

describe("inferAutoLayout (ED-079)", () => {
  it("tiga teks bertumpuk vertikal → column, urut atas→bawah, gap median", () => {
    // y: 10, 40 (gap 10), 80 (gap 20) → median gap 15; tinggi 20 tiap teks.
    const result = inferAutoLayout(frame, [child("c", 10, 80), child("a", 10, 10), child("b", 10, 40)]);
    expect(result.direction).toBe("column");
    expect(result.order).toEqual(["a", "b", "c"]);
    expect(result.gap).toBe(15);
  });

  it("deret horizontal → row, urut kiri→kanan, gap median", () => {
    // x: 10, 70 (gap 20 setelah lebar 40), 120 (gap 10) → gaps [20,10] median 15.
    const result = inferAutoLayout(frame, [child("b", 70, 10), child("a", 10, 10), child("c", 120, 10)]);
    expect(result.direction).toBe("row");
    expect(result.order).toEqual(["a", "b", "c"]);
    expect(result.gap).toBe(15);
  });

  it("padding = jarak minimum children ke tepi frame", () => {
    // children menempati x 20..260 (lebar 40 → kanan 60? ) — pakai satu anak untuk jelas.
    const result = inferAutoLayout(frame, [child("a", 20, 30, 100, 100)]);
    // kiri 20, atas 30, kanan 300-120=180, bawah 300-130=170.
    expect(result.padding).toEqual({ top: 30, left: 20, right: 180, bottom: 170 });
  });

  it("gap negatif (tumpang tindih) → 0", () => {
    const result = inferAutoLayout(frame, [child("a", 10, 10, 40, 20), child("b", 30, 10, 40, 20)]);
    expect(result.gap).toBe(0);
  });

  it("tanpa children → default aman", () => {
    const result = inferAutoLayout(frame, []);
    expect(result).toMatchObject({ gap: 0, order: [], padding: { top: 0, left: 0, right: 0, bottom: 0 } });
  });
});
