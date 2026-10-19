import { eq, schema } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import type { Express } from "express";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listRoutes } from "../test/route-inventory";
import { authTestApp, sessionCookie, signUpBody, TEST_ORIGIN, uniqueEmail } from "./auth/auth.test-harness";

// T1.6.6 (ARCHITECTURE §9.5, CLAUDE.md § Testing): isolasi tenant generik.
// 1. Inventaris: setiap rute lewat tenantResolver ATAU tercantum di allowlist beralasan; setiap rute tenant WAJIB
//    punya kasus isolasi di bawah → menambah endpoint data tanpa kasus isolasi membuat test ini gagal.
// 2. Setiap endpoint data dipanggil user lain dengan ID milik korban → wajib 404 dan data korban utuh.

// Rute non-tenant + alasannya. Menambah rute di sini = keputusan sadar (tinjau isolasinya).
const NON_TENANT_ROUTES: Record<string, string> = {
  "POST /auth/sign-up/email": "publik (registrasi)",
  "POST /auth/sign-in/email": "publik (login)",
  "POST /auth/send-verification-email": "publik (kirim ulang verifikasi; respons generik)",
  "POST /auth/request-password-reset": "publik (respons generik)",
  "POST /auth/reset-password": "token reset sekali pakai",
  "POST /auth/change-password": "sesi sendiri (Better Auth)",
  "POST /auth/change-email": "sesi sendiri (Better Auth + re-auth)",
  "_ALL /auth/*splat": "Better Auth (sesi sendiri / publik)",
  "GET /health/live": "publik (orchestrator)",
  "GET /health/ready": "publik (orchestrator)",
  "GET /v1/account/profile": "data user login (scope userId sesi)",
  "PATCH /v1/account/profile": "data user login",
  "GET /v1/account/consents": "data user login",
  "POST /v1/account/consents": "data user login",
  "GET /v1/account/sessions": "data user login",
  "POST /v1/account/sessions/revoke-others": "data user login",
  "DELETE /v1/account/sessions/:sessionId": "data user login — diuji isolasi di bawah",
  "GET /v1/workspaces":
    "daftar keanggotaan user login (scope userId sesi) — isolasi diuji di workspaces-list.int.test.ts",
  "POST /v1/realtime/token": "ID dokumen di body; akses dicek service — diuji isolasi di bawah",
  "GET /v1/library/components/:componentId/versions/:version":
    "library platform global (bukan tenant); hanya versi published; auth saja (CMP-158)",
  "POST /v1/admin/library/components":
    "admin library platform global (bukan tenant); role staf → non-staf 404 (CMP-159)",
  "PUT /v1/admin/library/components/:id/draft": "admin library platform global; role staf (CMP-159)",
  "POST /v1/admin/library/components/:id/draft/publish": "admin library platform global; role staf (CMP-159)",
  "POST /v1/admin/library/components/:id/deprecate": "admin library platform global; role staf (CMP-159)",
  "POST /v1/admin/library/components/:id/archive": "admin library platform global; role staf (CMP-159)",
  "GET /v1/admin/library/components/:id/usage": "admin library platform global; role staf (CMP-159)",
  "GET /internal/v1/ping": "service token",
  "GET /internal/v1/documents/:id/state": "service token (worker/realtime), lintas tenant via systemScope",
};

interface Victim {
  workspaceId: string;
  siteId: string;
  documentId: string;
  sessionId: string;
}

// Kasus isolasi: penyerang (user login lain) memakai ID milik korban.
const ISOLATION_CASES: Record<string, (app: Express, victim: Victim) => request.Test> = {
  "GET /v1/workspaces/:workspaceId/me": (app, v) => request(app).get(`/v1/workspaces/${v.workspaceId}/me`),
  "GET /v1/workspaces/:workspaceId/sites": (app, v) => request(app).get(`/v1/workspaces/${v.workspaceId}/sites`),
  "POST /v1/workspaces/:workspaceId/sites": (app, v) =>
    request(app).post(`/v1/workspaces/${v.workspaceId}/sites`).send({ name: "Situs Penyusup" }),
  "GET /v1/sites/:siteId": (app, v) => request(app).get(`/v1/sites/${v.siteId}`),
  "PATCH /v1/sites/:siteId": (app, v) => request(app).patch(`/v1/sites/${v.siteId}`).send({ name: "Dibajak" }),
  "DELETE /v1/sites/:siteId": (app, v) => request(app).delete(`/v1/sites/${v.siteId}`),
  // Bukan rute tenant, tapi menyentuh data milik orang lain lewat ID → wajib 404 juga.
  "POST /v1/realtime/token": (app, v) => request(app).post("/v1/realtime/token").send({ docId: v.documentId }),
  "DELETE /v1/account/sessions/:sessionId": (app, v) => request(app).delete(`/v1/account/sessions/${v.sessionId}`),
};

let testDb: TestDb;
let redis: Redis;
let app: Express;
let victim: Victim & { cookie: string };
let attackerCookie: string;
let ipCounter = 0;

async function register() {
  const email = uniqueEmail();
  const response = await request(app)
    .post("/auth/sign-up/email")
    .set("origin", TEST_ORIGIN)
    .set("x-forwarded-for", `198.18.3.${(ipCounter++ % 250) + 1}`)
    .send(signUpBody(email));
  const [user] = await testDb.db.select().from(schema.users).where(eq(schema.users.email, email));
  const [workspace] = await testDb.db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.ownerUserId, user?.id ?? ""));
  if (!workspace) throw new Error("registrasi gagal");
  return { cookie: sessionCookie(response.headers["set-cookie"]) ?? "", workspaceId: workspace.id };
}

beforeAll(async () => {
  testDb = await createTestDb();
  redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  app = authTestApp(testDb, redis, undefined, { internalJwtSecret: "internal-secret-0123456789abcdefghij" });
  const alice = await register();
  const site = (
    await request(app)
      .post(`/v1/workspaces/${alice.workspaceId}/sites`)
      .set("origin", TEST_ORIGIN)
      .set("cookie", alice.cookie)
      .send({ name: "Rahasia Alice" })
  ).body.data as { id: string; documentId: string };
  const sessions = (await request(app).get("/v1/account/sessions").set("cookie", alice.cookie)).body.data as {
    id: string;
  }[];
  victim = {
    cookie: alice.cookie,
    workspaceId: alice.workspaceId,
    siteId: site.id,
    documentId: site.documentId,
    sessionId: sessions[0]?.id ?? "",
  };
  attackerCookie = (await register()).cookie;
});
afterAll(async () => {
  redis.disconnect();
  await testDb.drop();
});

describe("inventaris rute (ARCHITECTURE §9.5)", () => {
  it("setiap rute lewat tenantResolver atau tercantum di allowlist beralasan", () => {
    const unprotected = listRoutes(app)
      .filter((route) => !route.tenantProtected)
      .map((route) => route.signature);
    expect(unprotected.filter((signature) => !(signature in NON_TENANT_ROUTES))).toEqual([]);
  });

  it("setiap rute tenant punya kasus isolasi; allowlist & kasus tidak merujuk rute yang tidak ada", () => {
    const routes = listRoutes(app);
    const signatures = new Set(routes.map((route) => route.signature));
    const tenantRoutes = routes.filter((route) => route.tenantProtected).map((route) => route.signature);
    expect(tenantRoutes.filter((signature) => !(signature in ISOLATION_CASES))).toEqual([]);
    expect(Object.keys(NON_TENANT_ROUTES).filter((signature) => !signatures.has(signature))).toEqual([]);
    expect(Object.keys(ISOLATION_CASES).filter((signature) => !signatures.has(signature))).toEqual([]);
  });
});

describe("isolasi tenant: user lain memakai ID milik korban → 404", () => {
  it.each(Object.keys(ISOLATION_CASES))("%s", async (signature) => {
    const build = ISOLATION_CASES[signature];
    if (!build) throw new Error(signature);
    const response = await build(app, victim).set("origin", TEST_ORIGIN).set("cookie", attackerCookie);
    expect(response.status).toBe(404);
    expect(response.body.error?.code).toBe("NOT_FOUND");
  });

  it("data korban tetap utuh setelah semua percobaan", async () => {
    const site = await request(app).get(`/v1/sites/${victim.siteId}`).set("cookie", victim.cookie);
    expect(site.status).toBe(200);
    expect(site.body.data.name).toBe("Rahasia Alice");
    const list = (await request(app).get(`/v1/workspaces/${victim.workspaceId}/sites`).set("cookie", victim.cookie))
      .body.data as { name: string }[];
    expect(list.map((item) => item.name)).toEqual(["Rahasia Alice"]);
    expect((await request(app).get("/v1/account/profile").set("cookie", victim.cookie)).status).toBe(200);
  });
});
