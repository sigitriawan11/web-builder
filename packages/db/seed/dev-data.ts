import { jsonToYDoc, type SiteDocument } from "@platform/document-model";
import { heroDocument, landing200 } from "@platform/document-model/fixtures";
import { eq, sql } from "drizzle-orm";
import * as Y from "yjs";
import type { Db } from "../src/client";
import { documentSnapshots, documents, sitePages, sites, users, workspaceMembers, workspaces } from "../src/schema";

// Data dev (ARCHITECTURE §6.1 Seed, CLAUDE.md "User dev dari seed"). Idempoten: ID tetap + upsert, user dicari
// lewat email dulu. Password login ditambahkan setelah Better Auth terpasang (T1.5) — format hash milik Better Auth.

// UUIDv7 tetap (format valid agar lolos validasi UuidV7Schema di aplikasi).
const ID = {
  owner: "01990000-0000-7000-8000-000000000001",
  admin: "01990000-0000-7000-8000-000000000002",
  ownerWorkspace: "01990000-0000-7000-8000-000000000101",
  adminWorkspace: "01990000-0000-7000-8000-000000000102",
  sites: [
    {
      site: "01990000-0000-7000-8000-000000000201",
      document: "01990000-0000-7000-8000-000000000301",
      snapshot: "01990000-0000-7000-8000-000000000401",
    },
    {
      site: "01990000-0000-7000-8000-000000000202",
      document: "01990000-0000-7000-8000-000000000302",
      snapshot: "01990000-0000-7000-8000-000000000402",
    },
  ],
} as const;

export const DEV_USERS = [
  {
    id: ID.owner,
    email: "owner@platform.test",
    name: "Owner Dev",
    staffRole: null,
    workspaceId: ID.ownerWorkspace,
    slug: "ws_ownerdev01",
  },
  {
    id: ID.admin,
    email: "admin@platform.test",
    name: "Admin Dev",
    staffRole: "super_admin",
    workspaceId: ID.adminWorkspace,
    slug: "ws_admindev01",
  },
] as const;

const DEV_SITES: { name: string; fixture: () => SiteDocument }[] = [
  { name: "Toko Kue Budi", fixture: heroDocument },
  { name: "Landing Contoh", fixture: landing200 },
];

async function ensureUser(db: Db, user: (typeof DEV_USERS)[number]): Promise<string> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, user.email));
  if (existing) return existing.id;
  await db
    .insert(users)
    .values({ id: user.id, email: user.email, name: user.name, emailVerified: true, staffRole: user.staffRole })
    .onConflictDoNothing();
  return user.id;
}

async function ensurePersonalWorkspace(db: Db, userId: string, user: (typeof DEV_USERS)[number]): Promise<string> {
  const [existing] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(sql`${workspaces.ownerUserId} = ${userId} and ${workspaces.type} = 'personal'`);
  const workspaceId = existing?.id ?? user.workspaceId;
  if (!existing) {
    await db
      .insert(workspaces)
      .values({
        id: workspaceId,
        slug: user.slug,
        type: "personal",
        name: `Workspace ${user.name}`,
        ownerUserId: userId,
      })
      .onConflictDoNothing();
  }
  await db.insert(workspaceMembers).values({ workspaceId, userId, role: "owner" }).onConflictDoNothing();
  return workspaceId;
}

/** Situs contoh dari fixture: dokumen + snapshot Yjs + read model halaman. */
async function ensureSite(
  db: Db,
  workspaceId: string,
  ids: (typeof ID.sites)[number],
  spec: (typeof DEV_SITES)[number],
): Promise<void> {
  const fixture = spec.fixture();
  const state = Y.encodeStateAsUpdate(jsonToYDoc(fixture));
  await db.transaction(async (tx) => {
    await tx
      .insert(documents)
      .values({
        id: ids.document,
        workspaceId,
        kind: "site",
        schemaVersion: fixture.schemaVersion,
        sizeBytes: state.byteLength,
      })
      .onConflictDoNothing();
    await tx
      .insert(sites)
      .values({ id: ids.site, workspaceId, name: spec.name, documentId: ids.document })
      .onConflictDoNothing();
    await tx
      .insert(documentSnapshots)
      .values({
        id: ids.snapshot,
        documentId: ids.document,
        uptoSeq: 0,
        state,
        json: fixture,
        kind: "named",
        label: "Seed",
      })
      .onConflictDoNothing();
    await tx
      .update(documents)
      .set({ siteId: ids.site, lastSnapshotId: ids.snapshot })
      .where(eq(documents.id, ids.document));

    // Read model halaman (turunan dokumen).
    const pages = fixture.pageOrder.flatMap((pageId, index) => {
      const node = fixture.nodes[pageId];
      if (node?.type !== "page") return [];
      const count = Object.values(fixture.nodes).filter((candidate) => candidate.parentId !== null).length;
      return [
        {
          siteId: ids.site,
          pageId,
          path: node.props.path,
          title: node.props.title,
          seo: node.props.seo ?? null,
          sortOrder: index,
          isHome: node.props.isHome ?? false,
          nodeCount: index === 0 ? count : 0,
        },
      ];
    });
    for (const page of pages) {
      await tx
        .insert(sitePages)
        .values(page)
        .onConflictDoUpdate({
          target: [sitePages.siteId, sitePages.pageId],
          set: { path: page.path, title: page.title, seo: page.seo, sortOrder: page.sortOrder, isHome: page.isHome },
        });
    }
  });
}

export interface SeedSummary {
  users: string[];
  sites: string[];
}

export async function seedDevData(db: Db): Promise<SeedSummary> {
  const workspaceByEmail = new Map<string, string>();
  for (const user of DEV_USERS) {
    const userId = await ensureUser(db, user);
    workspaceByEmail.set(user.email, await ensurePersonalWorkspace(db, userId, user));
  }
  const ownerWorkspace = workspaceByEmail.get("owner@platform.test");
  if (!ownerWorkspace) throw new Error("seed: workspace owner tidak terbentuk");
  for (const [index, spec] of DEV_SITES.entries()) {
    const ids = ID.sites[index];
    if (ids) await ensureSite(db, ownerWorkspace, ids, spec);
  }
  return { users: DEV_USERS.map((user) => user.email), sites: DEV_SITES.map((site) => site.name) };
}
