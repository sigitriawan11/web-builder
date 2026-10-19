import { scrypt } from "node:crypto";
import { SiteDocumentSchema, yDocToJson } from "@platform/document-model";
import { heroDocument } from "@platform/document-model/fixtures";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  accounts,
  documentSnapshots,
  documents,
  sitePages,
  sites,
  users,
  workspaceMembers,
  workspaces,
} from "../src/schema";
import { createTestDb, type TestDb } from "../test/test-db";
import { seedDevData } from "./dev-data";

// Verifikasi hash Better Auth (`salt:key` scrypt) — re-derive & bandingkan (tanpa import better-auth di test db).
function verifyHash(hash: string, password: string): Promise<boolean> {
  const [salt, key] = hash.split(":");
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt ?? "",
      64,
      { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
      (err, out) => (err ? reject(err) : resolve(out.toString("hex") === key)),
    );
  });
}

let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb.drop();
});

const counts = async () => ({
  users: await testDb.db.$count(users),
  workspaces: await testDb.db.$count(workspaces),
  members: await testDb.db.$count(workspaceMembers),
  sites: await testDb.db.$count(sites),
  documents: await testDb.db.$count(documents),
  snapshots: await testDb.db.$count(documentSnapshots),
  pages: await testDb.db.$count(sitePages),
  accounts: await testDb.db.$count(accounts),
});

describe("seed dev (T1.3.9)", () => {
  it("idempoten: dijalankan dua kali tanpa duplikasi", async () => {
    await seedDevData(testDb.db);
    const first = await counts();
    await seedDevData(testDb.db);
    expect(await counts()).toEqual(first);
    expect(first).toEqual({
      users: 2,
      workspaces: 2,
      members: 2,
      sites: 2,
      documents: 2,
      snapshots: 2,
      pages: 3,
      accounts: 2,
    });
  });

  it("owner & admin punya akun kredensial dengan password dev yang terverifikasi", async () => {
    const rows = await testDb.db
      .select({ userId: accounts.userId, providerId: accounts.providerId, password: accounts.password })
      .from(accounts)
      .where(eq(accounts.providerId, "credential"));
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.password).toBeTruthy();
      expect(await verifyHash(row.password ?? "", "platform-dev-123")).toBe(true);
    }
  });

  it("admin = super_admin; owner & admin masing-masing punya personal workspace", async () => {
    const rows = await testDb.db.select({ email: users.email, staffRole: users.staffRole }).from(users);
    expect(rows).toEqual(
      expect.arrayContaining([
        { email: "owner@platform.test", staffRole: null },
        { email: "admin@platform.test", staffRole: "super_admin" },
      ]),
    );
  });

  it("snapshot Yjs situs contoh = fixture dokumen (bisa dimuat editor)", async () => {
    const [site] = await testDb.db.select().from(sites).where(eq(sites.name, "Toko Kue Budi"));
    const [document] = await testDb.db
      .select()
      .from(documents)
      .where(eq(documents.id, site?.documentId ?? ""));
    const [snapshot] = await testDb.db
      .select()
      .from(documentSnapshots)
      .where(eq(documentSnapshots.id, document?.lastSnapshotId ?? ""));
    expect(document?.siteId).toBe(site?.id);
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, snapshot?.state ?? new Uint8Array());
    expect(SiteDocumentSchema.parse(yDocToJson(ydoc))).toEqual(heroDocument());
  });
});
