import { uuidv7 } from "@platform/shared";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import { assets, sites } from "./schema";
import {
  notDeleted,
  type SiteTenant,
  siteScope,
  siteWhere,
  systemScope,
  tenantLogFields,
  type WorkspaceTenant,
  workspaceScope,
  workspaceWhere,
} from "./tenant";

const db = drizzle.mock({ casing: "snake_case" });
const actor = { type: "user", userId: uuidv7(), role: "editor" } as const;
const workspaceId = uuidv7();
const siteId = uuidv7();

// Contoh fungsi repository sesuai pola ARCHITECTURE §6.2: tenant parameter pertama, filter selalu ditambahkan.
function findSite(tenant: WorkspaceTenant | SiteTenant, id: string) {
  return db
    .select()
    .from(sites)
    .where(and(workspaceWhere(tenant, sites), eq(sites.id, id), notDeleted(sites)))
    .toSQL();
}
function listSiteAssets(tenant: SiteTenant) {
  return db
    .select()
    .from(assets)
    .where(and(siteWhere(tenant, assets), notDeleted(assets)))
    .toSQL();
}

describe("TenantContext (ARCHITECTURE §6.2)", () => {
  it("scope tervalidasi & tidak bisa diubah setelah dibuat", () => {
    const tenant = siteScope({ workspaceId, siteId, actor });
    expect(tenant).toMatchObject({ kind: "site", workspaceId, siteId, actor });
    expect(Object.isFrozen(tenant)).toBe(true);
    expect(() => siteScope({ workspaceId: "ws_123", siteId, actor })).toThrow();
    expect(() => workspaceScope({ workspaceId, actor: { ...actor, role: "superuser" as "editor" } })).toThrow();
  });

  it("system scope wajib alasan; alasan ikut di field log", () => {
    expect(() => systemScope("  ")).toThrow(/wajib menyertakan alasan/);
    expect(tenantLogFields(systemScope("cleanup: compaction dokumen"))).toEqual({
      tenant: "system",
      systemReason: "cleanup: compaction dokumen",
    });
    expect(tenantLogFields(siteScope({ workspaceId, siteId, actor }))).toEqual({
      tenant: "site",
      workspaceId,
      siteId,
      actorType: "user",
    });
  });

  it("filter tenant selalu masuk ke SQL repository", () => {
    const byWorkspace = findSite(workspaceScope({ workspaceId, actor }), uuidv7());
    expect(byWorkspace.sql).toMatch(/"sites"\."workspace_id" = \$1/);
    expect(byWorkspace.sql).toContain('"sites"."deleted_at" is null');
    expect(byWorkspace.params[0]).toBe(workspaceId);

    // Tabel dengan site_id & workspace_id: keduanya difilter (defense-in-depth).
    const bySite = listSiteAssets(siteScope({ workspaceId, siteId, actor }));
    expect(bySite.sql).toMatch(/"assets"\."site_id" = \$1 and "assets"\."workspace_id" = \$2/);
    expect(bySite.params.slice(0, 2)).toEqual([siteId, workspaceId]);
  });

  it("type test: repository tidak bisa dipanggil tanpa tenant yang benar (dicek tsc -b)", () => {
    const site = siteScope({ workspaceId, siteId, actor });
    const system = systemScope("job: thumbnail");
    // @ts-expect-error objek biasa (mis. dari body request / output AI) bukan tenant ber-brand.
    findSite({ kind: "workspace", workspaceId, actor }, "x");
    // @ts-expect-error tenant wajib — tidak ada overload tanpa tenant.
    findSite("x");
    // @ts-expect-error system scope tidak otomatis boleh dipakai repository tenant.
    findSite(system, "x");
    // @ts-expect-error repository khusus situs menolak tenant workspace.
    listSiteAssets(workspaceScope({ workspaceId, actor }));
    // Yang benar tetap boleh.
    expect(findSite(site, "x").sql).toContain("workspace_id");
  });
});
