import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
  normalizeIntlSpaces,
} from "./format";

// ACC-291: snapshot kedua locale. ` ` = spasi tak terputus yang dipakai Intl antara simbol & angka.
const at = new Date("2026-10-12T07:30:00Z");

describe("formatCurrency (IDR, tanpa desimal)", () => {
  it("id → Rp; en → kode IDR", () => {
    expect(formatCurrency(49_000, "id")).toBe("Rp 49.000");
    expect(formatCurrency(1_500_000, "id")).toBe("Rp 1.500.000");
    expect(formatCurrency(49_000, "en")).toBe("IDR 49,000");
    expect(formatCurrency(12_345_678_901n, "id")).toBe("Rp 12.345.678.901");
    expect(formatCurrency(0, "id")).toBe("Rp 0");
  });
});

describe("formatNumber & formatBytes", () => {
  it("pemisah ribuan/desimal sesuai bahasa", () => {
    expect(formatNumber(1_234_567.5, "id")).toBe("1.234.567,5");
    expect(formatNumber(1_234_567.5, "en")).toBe("1,234,567.5");
  });

  it("ukuran berbasis 1024, maks 1 desimal", () => {
    expect(formatBytes(3_221_225_472, "id")).toBe("3 GB");
    expect(formatBytes(1_572_864, "id")).toBe("1,5 MB");
    expect(formatBytes(1_572_864, "en")).toBe("1.5 MB");
    expect(formatBytes(512, "id")).toBe("512 B");
    expect(formatBytes(-1, "id")).toBe("0 B");
  });
});

describe("tanggal di zona waktu user", () => {
  it("formatDate id/en; zona waktu menggeser tanggal", () => {
    expect(formatDate(at, "id")).toBe("12 Okt 2026");
    expect(formatDate(at, "en")).toBe("Oct 12, 2026");
    expect(formatDate(new Date("2026-10-12T20:00:00Z"), "id", "Asia/Jakarta")).toBe("13 Okt 2026");
    expect(formatDate(new Date("2026-10-12T20:00:00Z"), "id", "America/New_York")).toBe("12 Okt 2026");
  });

  it("formatDateTime menyertakan nama zona", () => {
    expect(formatDateTime(at, "id")).toBe("12 Okt 2026, 14.30 WIB");
    expect(formatDateTime(at, "id", "Asia/Makassar")).toBe("12 Okt 2026, 15.30 WITA");
    expect(formatDateTime(at, "en")).toBe("Oct 12, 2026, 02:30 PM GMT+7");
  });
});

describe("normalizeIntlSpaces", () => {
  it("U+202F (ICU baru) → spasi biasa; teks lain utuh", () => {
    expect(normalizeIntlSpaces(`02:30${String.fromCharCode(0x202f)}PM`)).toBe("02:30 PM");
    expect(normalizeIntlSpaces("12 Okt 2026, 14.30 WIB")).toBe("12 Okt 2026, 14.30 WIB");
  });
});

describe("formatRelative", () => {
  it.each([
    [0, "id", "sekarang"],
    [-3 * 60, "id", "3 menit yang lalu"],
    [-3 * 60, "en", "3 minutes ago"],
    [-2 * 3600, "id", "2 jam yang lalu"],
    [-86_400, "id", "kemarin"],
    [2 * 86_400, "en", "in 2 days"],
    [-14 * 86_400, "id", "2 minggu yang lalu"],
    [-400 * 86_400, "en", "last year"],
  ] as const)("%i detik (%s) → %s", (seconds, locale, expected) => {
    expect(formatRelative(new Date(at.getTime() + seconds * 1000), locale, at)).toBe(expected);
  });
});
