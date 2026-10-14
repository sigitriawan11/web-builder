import { and, type Db, eq, isNull, ne, schema } from "@platform/db";

// Akses dokumen untuk token realtime. Query SEBELUM tenant ada: di-scope userId dari sesi (keanggotaan workspace
// pemilik dokumen). M1: hanya dokumen situs yang situsnya belum dihapus (dokumen library menyusul di M3).

export interface DocumentAccess {
  documentId: string;
  siteId: string;
  workspaceId: string;
  role: (typeof schema.workspaceMembers.$inferSelect)["role"];
}

export async function findSiteDocumentAccess(
  db: Db,
  userId: string,
  documentId: string,
): Promise<DocumentAccess | undefined> {
  const [row] = await db
    .select({
      documentId: schema.documents.id,
      siteId: schema.sites.id,
      workspaceId: schema.documents.workspaceId,
      role: schema.workspaceMembers.role,
    })
    .from(schema.documents)
    .innerJoin(schema.sites, eq(schema.sites.id, schema.documents.siteId))
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.documents.workspaceId))
    .innerJoin(
      schema.workspaceMembers,
      and(
        eq(schema.workspaceMembers.workspaceId, schema.documents.workspaceId),
        eq(schema.workspaceMembers.userId, userId),
      ),
    )
    .where(
      and(
        eq(schema.documents.id, documentId),
        eq(schema.documents.kind, "site"),
        isNull(schema.sites.deletedAt),
        isNull(schema.workspaces.deletedAt),
        ne(schema.workspaces.status, "deleted"),
      ),
    );
  return row;
}
