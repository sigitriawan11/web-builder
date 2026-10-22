import { describe, expect, it } from "vitest";
import { auditPages } from "../src";

// T3.12.1 (CMP-080) — Dogfooding: 2 halaman contoh (kuliner & company profile) tersusun dari
// component published. Gate: semua blok ter-resolve ke component published, dan node bebas < 10%.

const FREE_NODE_LIMIT = 0.1; // AC CMP-093: node bebas (non-component) < 10% total node.

describe("dogfooding halaman contoh (T3.12.1)", () => {
  const audits = auditPages();

  it("menemukan ≥ 2 halaman contoh", () => {
    expect(audits.length).toBeGreaterThanOrEqual(2);
  });

  it("mencakup kuliner dan company profile", () => {
    const slugs = audits.map((audit) => audit.slug);
    expect(slugs).toContain("kuliner-warung-nusantara");
    expect(slugs).toContain("company-profile-maju-bersama");
  });

  it.each(audits.map((audit) => [audit.slug, audit] as const))("%s valid dan tanpa gap blok", (_slug, audit) => {
    // Cetak ringkasan agar laporan tampak di CI.
    console.log(
      `${audit.slug}: ${audit.blockCount} blok, ${audit.componentNodes} node component, free=${(audit.freeRatio * 100).toFixed(2)}%`,
    );
    expect(audit.issues, audit.issues.join("; ")).toEqual([]);
    expect(audit.missingBlocks).toEqual([]);
  });

  it.each(audits.map((audit) => [audit.slug, audit] as const))("%s: node bebas < 10%", (_slug, audit) => {
    expect(audit.freeRatio, `free = ${(audit.freeRatio * 100).toFixed(2)}%`).toBeLessThan(FREE_NODE_LIMIT);
  });
});
