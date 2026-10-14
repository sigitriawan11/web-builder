import { eq, schema } from "@platform/db";
import { createTestDb, createWorkspace, type TestDb } from "@platform/db/testing";
import { uuidv7 } from "@platform/shared";
import {
  REALTIME_TOKEN_AUDIENCE,
  RealtimeTokenClaimsSchema,
  RealtimeTokenResponseSchema,
  type WorkspaceRole,
} from "@platform/shared/contracts";
import { verifyToken } from "@platform/shared/node";
import type { Express } from "express";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  authTestApp,
  sessionCookie,
  signUpBody,
  TEST_ORIGIN,
  TEST_REALTIME_SECRET,
  uniqueEmail,
} from "../../auth/auth.test-harness";

// T1.6.4 (ARCHITECTURE §5.5, §7.3): token realtime hanya untuk dokumen situs yang boleh diakses user.
let testDb: TestDb;
let redis: Redis;
let target: Express;
let ipCounter = 0;

beforeAll(async () => {
  testDb = await createTestDb();
  redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  target = authTestApp(testDb, redis);
});
afterAll(async () => {
  redis.disconnect();
  await testDb.drop();
});

async function register() {
  const email = uniqueEmail();
  const response = await request(target)
    .post("/auth/sign-up/email")
    .set("origin", TEST_ORIGIN)
    .set("x-forwarded-for", `198.18.2.${(ipCounter++ % 250) + 1}`)
    .send(signUpBody(email));
  const [user] = await testDb.db.select().from(schema.users).where(eq(schema.users.email, email));
  const [workspace] = await testDb.db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.ownerUserId, user?.id ?? ""));
  if (!user || !workspace) throw new Error("registrasi gagal");
  return { cookie: sessionCookie(response.headers["set-cookie"]) ?? "", user, workspace };
}

async function siteIn(owner: Awaited<ReturnType<typeof register>>, workspaceId = owner.workspace.id) {
  const response = await request(target)
    .post(`/v1/workspaces/${workspaceId}/sites`)
    .set("origin", TEST_ORIGIN)
    .set("cookie", owner.cookie)
    .send({ name: "Situs Realtime" });
  return response.body.data as { id: string; documentId: string };
}

const issue = (cookie: string | null, body: unknown) => {
  const call = request(target).post("/v1/realtime/token").set("origin", TEST_ORIGIN);
  return (cookie ? call.set("cookie", cookie) : call).send(body as object);
};

const verify = (token: string, secret = TEST_REALTIME_SECRET, audience = REALTIME_TOKEN_AUDIENCE) =>
  verifyToken(secret, token, { audience, claims: RealtimeTokenClaimsSchema });

describe("POST /v1/realtime/token", () => {
  it("pemilik → JWT 5 menit untuk dokumen itu (sub, docId, siteId, role) + URL WebSocket; tidak di-cache", async () => {
    const alice = await register();
    const site = await siteIn(alice);
    const response = await issue(alice.cookie, { docId: site.documentId });
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const data = RealtimeTokenResponseSchema.parse(response.body.data);
    expect(data.url).toBe("ws://realtime.localhost:4100");

    const claims = await verify(data.token);
    expect(claims.ok && claims.value).toMatchObject({
      sub: alice.user.id,
      docId: site.documentId,
      siteId: site.id,
      role: "owner",
    });
    const ttl = claims.ok ? claims.value.exp * 1000 - Date.now() : 0;
    expect(ttl).toBeGreaterThan(290_000);
    expect(ttl).toBeLessThanOrEqual(300_000);
    expect(new Date(data.expiresAt).getTime()).toBe(claims.ok ? claims.value.exp * 1000 : 0);

    // Hanya valid untuk audience & secret realtime.
    expect((await verify(data.token, "secret-lain-yang-cukup-panjang-0123456789")).ok).toBe(false);
    expect((await verify(data.token, TEST_REALTIME_SECRET, "worker")).ok).toBe(false);
  });

  it.each([
    ["viewer", 200],
    ["editor", 200],
    ["billing", 403],
  ] as const)("anggota team ber-role %s → %i (role ikut di token)", async (role: WorkspaceRole, status) => {
    const alice = await register();
    const member = await register();
    const team = await createWorkspace(testDb.db, { owner: alice.user });
    await testDb.db.insert(schema.workspaceMembers).values({ workspaceId: team.id, userId: member.user.id, role });
    const site = await siteIn(alice, team.id);
    const response = await issue(member.cookie, { docId: site.documentId });
    expect(response.status).toBe(status);
    if (status === 200) {
      const claims = await verify(response.body.data.token);
      expect(claims.ok && claims.value.role).toBe(role);
    }
  });

  it("bukan anggota / dokumen acak / situs dihapus → 404 (tidak bocor)", async () => {
    const alice = await register();
    const bob = await register();
    const site = await siteIn(alice);
    expect((await issue(bob.cookie, { docId: site.documentId })).status).toBe(404);
    expect((await issue(alice.cookie, { docId: uuidv7() })).status).toBe(404);

    await request(target).delete(`/v1/sites/${site.id}`).set("origin", TEST_ORIGIN).set("cookie", alice.cookie);
    expect((await issue(alice.cookie, { docId: site.documentId })).status).toBe(404);
  });

  it("tanpa sesi → 401; body tidak valid → 422", async () => {
    const alice = await register();
    expect((await issue(null, { docId: uuidv7() })).status).toBe(401);
    expect((await issue(alice.cookie, { docId: "bukan-uuid" })).status).toBe(422);
    expect((await issue(alice.cookie, {})).status).toBe(422);
  });
});
