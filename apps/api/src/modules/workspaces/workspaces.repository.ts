import { and, type DbExecutor, eq, isNull, ne, schema, sql } from "@platform/db";

// Workspace milik user (ACC-030). Pembuatan personal workspace dipanggil hook registrasi dalam transaksi user.

/**
 * Buat personal workspace + keanggotaan owner. Idempoten: unique index "satu personal per owner" → bila sudah ada,
 * tidak membuat apa pun dan mengembalikan `null` (mis. Google ditautkan ke user lama).
 */
export async function insertPersonalWorkspace(
  executor: DbExecutor,
  input: { userId: string; name: string; slug: string },
): Promise<{ id: string } | null> {
  const [workspace] = await executor
    .insert(schema.workspaces)
    .values({ slug: input.slug, type: "personal", name: input.name, ownerUserId: input.userId })
    .onConflictDoNothing({
      target: schema.workspaces.ownerUserId,
      where: sql`${schema.workspaces.type} = 'personal'`,
    })
    .returning({ id: schema.workspaces.id });
  if (!workspace) return null;
  await executor
    .insert(schema.workspaceMembers)
    .values({ workspaceId: workspace.id, userId: input.userId, role: "owner" });
  return workspace;
}

// --- Keanggotaan (tenantResolver, ARCHITECTURE §5.3). Query SEBELUM tenant ada: selalu di-scope userId dari sesi. ---

const activeWorkspace = and(isNull(schema.workspaces.deletedAt), ne(schema.workspaces.status, "deleted"));

export interface Membership {
  workspaceId: string;
  role: (typeof schema.workspaceMembers.$inferSelect)["role"];
}

/** Keanggotaan user di workspace aktif; `undefined` = bukan anggota / workspace tidak ada / dihapus. */
export async function findMembership(
  executor: DbExecutor,
  userId: string,
  workspaceId: string,
): Promise<Membership | undefined> {
  const [row] = await executor
    .select({ workspaceId: schema.workspaceMembers.workspaceId, role: schema.workspaceMembers.role })
    .from(schema.workspaceMembers)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.workspaceMembers.workspaceId))
    .where(
      and(
        eq(schema.workspaceMembers.userId, userId),
        eq(schema.workspaceMembers.workspaceId, workspaceId),
        activeWorkspace,
      ),
    );
  return row;
}

/** Keanggotaan user di workspace pemilik situs (situs belum dihapus). */
export async function findSiteMembership(
  executor: DbExecutor,
  userId: string,
  siteId: string,
): Promise<Membership | undefined> {
  const [row] = await executor
    .select({ workspaceId: schema.sites.workspaceId, role: schema.workspaceMembers.role })
    .from(schema.sites)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.sites.workspaceId))
    .innerJoin(
      schema.workspaceMembers,
      and(
        eq(schema.workspaceMembers.workspaceId, schema.sites.workspaceId),
        eq(schema.workspaceMembers.userId, userId),
      ),
    )
    .where(and(eq(schema.sites.id, siteId), isNull(schema.sites.deletedAt), activeWorkspace));
  return row;
}

export async function findWorkspaceSummary(executor: DbExecutor, workspaceId: string) {
  const [row] = await executor
    .select({
      id: schema.workspaces.id,
      slug: schema.workspaces.slug,
      name: schema.workspaces.name,
      type: schema.workspaces.type,
    })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId));
  return row;
}
