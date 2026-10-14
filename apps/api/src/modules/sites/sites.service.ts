import type { Db, SiteTenant, WorkspaceTenant } from "@platform/db";
import { CURRENT_SCHEMA_VERSION } from "@platform/document-model";
import { AppError } from "@platform/shared";
import type { CreateSiteBody, Site, UpdateSiteBody } from "@platform/shared/contracts";
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

const CursorPosition = z.object({ id: z.uuid() });

export function createSitesService(deps: { db: Db }) {
  const { db } = deps;
  return {
    async list(tenant: Tenant, query: { limit: number; cursor?: string | undefined }) {
      assertCan(tenant, "site.read");
      const position = query.cursor ? decodeCursor(CursorPosition, query.cursor) : null;
      if (query.cursor && !position) {
        throw new AppError("VALIDATION_FAILED", 422, {
          issues: [{ location: "query", path: "cursor", code: "invalid_cursor", message: "cursor tidak valid" }],
        });
      }
      // Ambil satu lebih untuk tahu apakah masih ada halaman berikutnya.
      const rows = await repository.listSites(db, tenant, {
        limit: query.limit + 1,
        ...(position ? { beforeId: position.id } : {}),
      });
      const page = rows.slice(0, query.limit);
      const last = page.at(-1);
      return {
        items: page.map(toDto),
        nextCursor: rows.length > query.limit && last ? encodeCursor({ id: last.id }) : null,
      };
    },

    async get(tenant: Tenant, siteId: string): Promise<Site> {
      assertCan(tenant, "site.read");
      const row = await repository.findSite(db, tenant, siteId);
      if (!row) throw new AppError("NOT_FOUND");
      return toDto(row);
    },

    async create(tenant: Tenant, body: CreateSiteBody): Promise<Site> {
      assertCan(tenant, "site.create");
      // Batas jumlah situs per paket (ACC-131, PLAN_LIMIT_REACHED) dipasang saat entitlements (M4).
      const row = await db.transaction((tx) =>
        repository.insertSiteWithDocument(tx, tenant, { name: body.name, schemaVersion: CURRENT_SCHEMA_VERSION }),
      );
      return toDto(row);
    },

    async rename(tenant: Tenant, siteId: string, body: UpdateSiteBody): Promise<Site> {
      assertCan(tenant, "site.edit");
      const row = await repository.updateSiteName(db, tenant, siteId, body.name);
      if (!row) throw new AppError("NOT_FOUND");
      return toDto(row);
    },

    async remove(tenant: Tenant, siteId: string): Promise<void> {
      // Editor hanya boleh situs buatannya (ACC-033) → perlu baris situs dulu; tenant lain/terhapus = 404.
      const site = await repository.findSite(db, tenant, siteId);
      if (!site) throw new AppError("NOT_FOUND");
      assertCan(tenant, "site.delete", { createdBy: site.createdBy });
      if (!(await repository.softDeleteSite(db, tenant, siteId))) throw new AppError("NOT_FOUND");
    },
  };
}

export type SitesService = ReturnType<typeof createSitesService>;
