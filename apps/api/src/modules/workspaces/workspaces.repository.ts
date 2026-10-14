import { type DbExecutor, schema, sql } from "@platform/db";

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
