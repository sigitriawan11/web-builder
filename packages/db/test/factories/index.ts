import { fakerID_ID as faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import type { Db } from "../../src/client";
import { documents, sites, users, workspaceMembers, workspaces } from "../../src/schema";

// Factory data test (ARCHITECTURE §14): data realistis Indonesia (faker `id_ID`) lewat query builder Drizzle
// (bukan SQL mentah) dan menegakkan aturan bisnis yang sama dengan produk — mis. setiap user langsung punya
// personal workspace + keanggotaan owner (spec 08 ACC-030). Repository API (apps/api) tidak bisa dipakai di sini
// karena packages dilarang mengimport apps (ARCHITECTURE §4.3).

export { faker };

type UserRow = typeof users.$inferSelect;
type WorkspaceRow = typeof workspaces.$inferSelect;
type SiteRow = typeof sites.$inferSelect;
type DocumentRow = typeof documents.$inferSelect;

let sequence = 0;
// Email & slug harus unik; faker bisa berulang, jadi ditambah penanda urut.
const unique = () => `${Date.now().toString(36)}${(sequence++).toString(36)}`;

export const personalWorkspaceSlug = () => `ws_${faker.string.alphanumeric({ length: 10, casing: "lower" })}`;

export interface CreateUserOptions {
  name?: string;
  email?: string;
  staffRole?: UserRow["staffRole"];
  emailVerified?: boolean;
}

/** User + personal workspace + keanggotaan owner (ACC-030), dalam satu transaksi. */
export async function createUser(
  db: Db,
  options: CreateUserOptions = {},
): Promise<{ user: UserRow; workspace: WorkspaceRow }> {
  const firstName = faker.person.firstName();
  const name = options.name ?? `${firstName} ${faker.person.lastName()}`;
  const email = options.email ?? `${firstName.toLowerCase().replace(/[^a-z]/g, "")}.${unique()}@platform.test`;
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ name, email, emailVerified: options.emailVerified ?? true, staffRole: options.staffRole ?? null })
      .returning();
    if (!user) throw new Error("createUser: insert user gagal");
    const [workspace] = await tx
      .insert(workspaces)
      .values({ slug: personalWorkspaceSlug(), type: "personal", name: `Workspace ${firstName}`, ownerUserId: user.id })
      .returning();
    if (!workspace) throw new Error("createUser: insert workspace gagal");
    await tx.insert(workspaceMembers).values({ workspaceId: workspace.id, userId: user.id, role: "owner" });
    return { user, workspace };
  });
}

/** Team workspace milik `owner` (role owner), M9. */
export async function createWorkspace(db: Db, options: { owner: UserRow; name?: string }): Promise<WorkspaceRow> {
  return db.transaction(async (tx) => {
    const [workspace] = await tx
      .insert(workspaces)
      .values({
        slug: `tim-${unique()}`,
        type: "team",
        name: options.name ?? faker.company.name(),
        ownerUserId: options.owner.id,
      })
      .returning();
    if (!workspace) throw new Error("createWorkspace: insert gagal");
    await tx.insert(workspaceMembers).values({ workspaceId: workspace.id, userId: options.owner.id, role: "owner" });
    return workspace;
  });
}

/**
 * Situs + dokumennya dalam satu transaksi (FK dua arah, ARCHITECTURE §6.3): dokumen → situs → `documents.site_id`.
 * `schemaVersion` default 9 = CURRENT_SCHEMA_VERSION (db hanya boleh import type-only dari document-model, jadi
 * angka ini disalin; naikkan bersama bump schema agar factory menyeed dokumen versi terkini, bukan memicu migrasi).
 */
export async function createSite(
  db: Db,
  options: { workspace: WorkspaceRow; name?: string; status?: SiteRow["status"]; schemaVersion?: number },
): Promise<{ site: SiteRow; document: DocumentRow }> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(documents)
      .values({ workspaceId: options.workspace.id, kind: "site", schemaVersion: options.schemaVersion ?? 9 })
      .returning();
    if (!created) throw new Error("createSite: insert dokumen gagal");
    const [site] = await tx
      .insert(sites)
      .values({
        workspaceId: options.workspace.id,
        name: options.name ?? `Toko ${faker.person.firstName()}`,
        status: options.status ?? "draft",
        documentId: created.id,
      })
      .returning();
    if (!site) throw new Error("createSite: insert situs gagal");
    const [document] = await tx
      .update(documents)
      .set({ siteId: site.id })
      .where(eq(documents.id, created.id))
      .returning();
    if (!document) throw new Error("createSite: update dokumen gagal");
    return { site, document };
  });
}
