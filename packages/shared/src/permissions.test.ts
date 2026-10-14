import { describe, expect, it } from "vitest";
import type { WorkspaceRole } from "./contracts/workspaces";
import { ACTIONS, type Action, can, permissionsFor } from "./permissions";

// Tabel ACC-033 disalin ULANG di sini (bukan dari implementasi) — setiap sel matriks diuji (AC ACC-033).
// ✅ = "Y", ❌ = "-", 🔸 = "own" (resource buatannya) / "below" (bukan owner/admin).
const SPEC: Record<Action, [string, string, string, string, string]> = {
  //                  owner admin  editor viewer billing
  "site.read": ["Y", "Y", "Y", "Y", "-"],
  "site.create": ["Y", "Y", "Y", "-", "-"],
  "site.edit": ["Y", "Y", "Y", "-", "-"],
  "site.publish": ["Y", "Y", "Y", "-", "-"],
  "site.delete": ["Y", "Y", "own", "-", "-"],
  "site.domain": ["Y", "Y", "-", "-", "-"],
  "site.transfer": ["Y", "-", "-", "-", "-"],
  "site.comment": ["Y", "Y", "Y", "Y", "-"],
  "ai.use": ["Y", "Y", "Y", "-", "-"],
  "data.read": ["Y", "Y", "Y", "Y", "-"],
  "data.schema": ["Y", "Y", "Y", "-", "-"],
  "data.export": ["Y", "Y", "-", "-", "-"],
  "data.members": ["Y", "Y", "-", "-", "-"],
  "payments.config": ["Y", "Y", "-", "-", "-"],
  "commerce.products": ["Y", "Y", "Y", "-", "-"],
  "commerce.orders": ["Y", "Y", "-", "-", "-"],
  "billing.read": ["Y", "Y", "-", "-", "Y"],
  "billing.manage": ["Y", "-", "-", "-", "Y"],
  "billing.cancel": ["Y", "-", "-", "-", "-"],
  "members.read": ["Y", "Y", "Y", "Y", "Y"],
  "members.manage": ["Y", "below", "-", "-", "-"],
  "workspace.update": ["Y", "Y", "-", "-", "-"],
  "workspace.delete": ["Y", "-", "-", "-", "-"],
  "workspace.transfer": ["Y", "-", "-", "-", "-"],
};
const ROLES: WorkspaceRole[] = ["owner", "admin", "editor", "viewer", "billing"];
const ME = "01a135f2-b67d-71b3-9fbc-775f6ef635e9";
const OTHER = "01a135f2-b6cc-77fb-893d-af4f62d11c71";

const cells = ACTIONS.flatMap((action) => ROLES.map((role, index) => [action, role, SPEC[action][index]] as const));

describe("matriks izin ACC-033 (setiap sel)", () => {
  it("spec test mencakup semua aksi", () => {
    expect(Object.keys(SPEC).sort()).toEqual([...ACTIONS].sort());
  });

  it.each(cells)("%s · %s → %s", (action, role, expected) => {
    const actor = { role, userId: ME };
    if (expected === "Y") expect(can(actor, action)).toBe(true);
    else if (expected === "-") {
      expect(can(actor, action)).toBe(false);
      // Tidak bisa "dibuka" dengan data resource apa pun.
      expect(can(actor, action, { createdBy: ME, targetRole: "viewer" })).toBe(false);
    } else if (expected === "own") {
      expect(can(actor, action, { createdBy: ME })).toBe(true);
      expect(can(actor, action, { createdBy: OTHER })).toBe(false);
      expect(can(actor, action, { createdBy: null })).toBe(false);
      expect(can(actor, action)).toBe(false);
    } else {
      for (const target of ["editor", "viewer", "billing"] as const) {
        expect(can(actor, action, { targetRole: target })).toBe(true);
      }
      expect(can(actor, action, { targetRole: "owner" })).toBe(false);
      expect(can(actor, action, { targetRole: "admin" })).toBe(false);
      expect(can(actor, action)).toBe(false);
    }
  });
});

describe("permissionsFor (UI)", () => {
  it("owner: semua aksi; billing: hanya billing & daftar anggota", () => {
    expect(permissionsFor("owner")).toEqual([...ACTIONS]);
    expect(permissionsFor("billing").sort()).toEqual(["billing.manage", "billing.read", "members.read"]);
  });
  it("aksi terbatas ikut ditampilkan (keputusan akhir per resource di server)", () => {
    expect(permissionsFor("editor")).toContain("site.delete");
    expect(permissionsFor("admin")).toContain("members.manage");
  });
});
