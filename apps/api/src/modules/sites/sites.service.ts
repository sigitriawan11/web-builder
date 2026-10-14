import type { Db, SiteTenant, WorkspaceTenant } from "@platform/db";
import { CURRENT_SCHEMA_VERSION, createBlankSiteDocument, siteDocumentToState } from "@platform/document-model";
import { AppError } from "@platform/shared";
import type { CreateSiteBody, ListSitesQuery, Site, UpdateSiteBody } from "@platform/shared/contracts";
import { decodeCursor, encodeCursor } from "@platform/shared/contracts";
import { z } from "zod";
import { assertCan } from "../../permissions";
import * as repository from "./sites.repository";

// Logika bisnis sites (CLAUDE.md § Struktur modul API): transaksi, aturan akses, pemetaan row → DTO kontrak.
// Resource di luar tenant = NOT_FOUND (bukan FORBIDDEN) agar keberadaannya tidak bocor (ARCHITECTURE §5.3).

type Tenant = WorkspaceTenant | SiteTenant;

function toDto(row: repository.SiteRow): Site {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    status: row.status,
    documentId: row.documentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Cursor terikat urutan: cursor dari urutan lain → tidak valid (422), bukan halaman yang salah.
const CursorPosition = z.discriminatedUnion("sort", [
  z.object({ sort: z.literal("updated"), value: z.string().min(1).max(40), id: z.uuid() }),
  z.object({ sort: z.literal("name"), value: z.string().max(200), id: z.uuid() }),
  z.object({ sort: z.literal("created"), id: z.uuid() }),
]);

export function createSitesService(deps: { db: Db }) {
  const { db } = deps;
  return {
    async list(tenant: Tenant, query: ListSitesQuery) {
      assertCan(tenant, "site.read");
      const position = query.cursor ? decodeCursor(CursorPosition, query.cursor) : null;
      if (query.cursor && (!position || position.sort !== query.sort)) {
        throw new AppError("VALIDATION_FAILED", 422, {
          issues: [{ location: "query", path: "cursor", code: "invalid_cursor", message: "cursor tidak valid" }],
        });
      }
      // Ambil satu lebih untuk tahu apakah masih ada halaman berikutnya.
      const rows = await repository.listSites(db, tenant, {
        status: query.status,
        sort: query.sort,
        ...(query.q ? { q: query.q } : {}),
        limit: query.limit + 1,
        ...(position ? { after: position } : {}),
      });
      const page = rows.slice(0, query.limit);
      const last = page.at(-1);
      const nextPosition =
        rows.length > query.limit && last
          ? query.sort === "created"
            ? { sort: "created" as const, id: last.id }
            : { sort: query.sort, value: last.cursorValue, id: last.id }
          : null;
      return { items: page.map(toDto), nextCursor: nextPosition ? encodeCursor(nextPosition) : null };
    },

    async get(tenant: SiteTenant): Promise<Site> {
      assertCan(tenant, "site.read");
      const row = await repository.findSite(db, tenant, tenant.siteId);
      if (!row) throw new AppError("NOT_FOUND");
      return toDto(row);
    },

    async create(tenant: Tenant, body: CreateSiteBody): Promise<Site> {
      assertCan(tenant, "site.create");
      // Batas jumlah situs per paket (ACC-131, PLAN_LIMIT_REACHED) dipasang saat entitlements (M4).
      // Situs kosong (ACC-051 "blank"): dokumen awal 1 page Home, tervalidasi strict sebelum disimpan.
      const document = createBlankSiteDocument({ title: body.name });
      const state = siteDocumentToState(document);
      const site = await db.transaction(async (tx) => {
        const created = await repository.insertSiteWithDocument(tx, tenant, {
          name: body.name,
          schemaVersion: CURRENT_SCHEMA_VERSION,
        });
        await repository.writeInitialDocument(tx, tenant, {
          siteId: created.site.id,
          documentId: created.documentId,
          document,
          state,
          createdBy: tenant.actor.type === "staff" ? null : tenant.actor.userId,
        });
        return created.site;
      });
      return toDto(site);
    },

    async rename(tenant: SiteTenant, body: UpdateSiteBody): Promise<Site> {
      assertCan(tenant, "site.edit");
      const row = await repository.updateSiteName(db, tenant, tenant.siteId, body.name);
      if (!row) throw new AppError("NOT_FOUND");
      return toDto(row);
    },

    async remove(tenant: SiteTenant): Promise<void> {
      // Editor hanya boleh situs buatannya (ACC-033) → perlu baris situs dulu; terhapus = 404.
      const site = await repository.findSite(db, tenant, tenant.siteId);
      if (!site) throw new AppError("NOT_FOUND");
      assertCan(tenant, "site.delete", { createdBy: site.createdBy });
      if (!(await repository.softDeleteSite(db, tenant, tenant.siteId))) throw new AppError("NOT_FOUND");
    },
  };
}

export type SitesService = ReturnType<typeof createSitesService>;
