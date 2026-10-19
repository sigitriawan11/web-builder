import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { documents, users, workspaceMembers, workspaces } from "../src/schema";
import { createSite, createUser, createWorkspace } from "./factories";
import { createTestDb, type TestDb } from "./test-db";

let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb.drop();
});

describe("factories (ARCHITECTURE §14)", () => {
  it("createUser: user + personal workspace + owner (ACC-030), data Indonesia", async () => {
    const { user, workspace } = await createUser(testDb.db);
    expect(user.email).toMatch(/@platform\.test$/);
    expect(user.locale).toBe("id");
    expect(workspace).toMatchObject({ type: "personal", ownerUserId: user.id });
    expect(workspace.slug).toMatch(/^ws_[0-9a-z]{10}$/);
    const members = await testDb.db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspace.id));
    expect(members).toEqual([expect.objectContaining({ userId: user.id, role: "owner" })]);
  });

  it("banyak user sekaligus tidak bentrok di kunci unik (email, slug)", async () => {
    const created = await Promise.all(Array.from({ length: 25 }, () => createUser(testDb.db)));
    expect(new Set(created.map(({ user }) => user.email)).size).toBe(25);
    expect(await testDb.db.$count(users)).toBeGreaterThanOrEqual(25);
  });

  it("override field bekerja (staff, email)", async () => {
    const { user } = await createUser(testDb.db, { email: "admin@platform.test", staffRole: "super_admin" });
    expect(user).toMatchObject({ email: "admin@platform.test", staffRole: "super_admin" });
  });

  it("createWorkspace: team workspace dengan owner", async () => {
    const { user } = await createUser(testDb.db);
    const team = await createWorkspace(testDb.db, { owner: user, name: "Tim Kue" });
    expect(team).toMatchObject({ type: "team", name: "Tim Kue", ownerUserId: user.id });
    expect(await testDb.db.$count(workspaces, eq(workspaces.ownerUserId, user.id))).toBe(2);
  });

  it("createSite: situs ↔ dokumen saling terhubung, status default draft", async () => {
    const { workspace } = await createUser(testDb.db);
    const { site, document } = await createSite(testDb.db, { workspace });
    expect(site).toMatchObject({ workspaceId: workspace.id, status: "draft", documentId: document.id });
    // schemaVersion = default factory (CURRENT_SCHEMA_VERSION, disalin karena db hanya type-only ke document-model).
    expect(document).toMatchObject({ siteId: site.id, kind: "site", schemaVersion: 8 });
    const [stored] = await testDb.db.select().from(documents).where(eq(documents.id, document.id));
    expect(stored?.siteId).toBe(site.id);
  });
});
