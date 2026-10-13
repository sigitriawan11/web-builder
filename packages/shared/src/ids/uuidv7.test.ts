import { describe, expect, it } from "vitest";
import { createUuidV7Generator, UUIDV7_PATTERN, UuidV7Schema, uuidV7Timestamp, uuidv7 } from "./uuidv7";

const fixedRandom = (fill: number) => (bytes: Uint8Array) => bytes.fill(fill);

describe("uuidv7 (RFC 9562, ARCHITECTURE §6.1)", () => {
  it("format UUIDv7: versi 7, varian 10xx, huruf kecil", () => {
    for (let i = 0; i < 1000; i++) expect(uuidv7()).toMatch(UUIDV7_PATTERN);
    expect(UuidV7Schema.safeParse(uuidv7()).success).toBe(true);
    // UUIDv4 ditolak.
    expect(UuidV7Schema.safeParse("9b2f1c3e-5d4a-4b6c-8d7e-0f1a2b3c4d5e").success).toBe(false);
  });

  it("timestamp tertanam bisa dibaca kembali", () => {
    const at = Date.UTC(2026, 9, 13, 8, 30, 0, 123);
    const id = createUuidV7Generator(() => at)();
    expect(id.replace("-", "").slice(0, 12)).toBe(at.toString(16).padStart(12, "0"));
    expect(uuidV7Timestamp(id)).toBe(at);
    expect(uuidV7Timestamp("bukan-uuid")).toBeNull();
  });

  it("urutan waktu: ID yang dibuat belakangan selalu lebih besar secara leksikografis (tanpa perlu parse)", () => {
    let clock = 1_700_000_000_000;
    const next = createUuidV7Generator(() => (clock += 7));
    const ids = Array.from({ length: 500 }, () => next());
    expect([...ids].sort()).toEqual(ids);
  });

  it("monoton dalam milidetik yang sama walau bagian acak menurun (counter, bukan random)", () => {
    let fill = 0xff;
    const next = createUuidV7Generator(
      () => 1_700_000_000_000,
      (bytes) => bytes.fill(fill--),
    );
    const ids = Array.from({ length: 200 }, () => next());
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("counter habis (> 4096 ID/ms) meminjam milidetik berikutnya, urutan tetap terjaga", () => {
    const next = createUuidV7Generator(() => 1_700_000_000_000, fixedRandom(0));
    const ids = Array.from({ length: 5000 }, () => next());
    expect([...ids].sort()).toEqual(ids);
    expect(uuidV7Timestamp(ids.at(-1) ?? "")).toBe(1_700_000_000_001);
  });

  it("jam mundur tidak membuat ID turun", () => {
    const times = [1_700_000_000_500, 1_700_000_000_100, 1_700_000_000_600];
    const next = createUuidV7Generator(() => times.shift() ?? 0);
    const ids = [next(), next(), next()];
    expect([...ids].sort()).toEqual(ids);
  });

  it("generator global unik untuk 10.000 ID", () => {
    const ids = Array.from({ length: 10_000 }, () => uuidv7());
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
  });
});
