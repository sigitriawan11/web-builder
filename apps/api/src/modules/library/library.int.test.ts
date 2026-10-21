import { schema } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import { uuidv7 } from "@platform/shared";
import { stableHash } from "@platform/shared/node";
import type { Express } from "express";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authTestApp, sessionCookie, signUpBody, TEST_ORIGIN, uniqueEmail } from "../../auth/auth.test-harness";

// T3.3.8 (CMP-050/CMP-158): editor membaca definisi versi published library platform. Global (bukan tenant):
// hanya butuh login; versi published immutable → boleh di-cache selamanya. Draft/yanked/non-platform → 404.
let testDb: TestDb;
let redis: Redis;
let target: Express;
let ipCounter = 0;

const PUBLIC_ID = "cmp_testbtn01";
const DEFINITION = { rootId: "n1", nodes: { n1: { type: "box", props: {} } } };

beforeAll(async () => {
  testDb = await createTestDb();
  redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  target = authTestApp(testDb, redis);

  const categoryId = uuidv7();
  await testDb.db.insert(schema.libraryCategories).values({
    id: categoryId,
    slug: "test-buttons",
    scope: "component",
    type: "functional",
    name: { id: "Tombol", en: "Buttons" },
  });
  const componentId = uuidv7();
  await testDb.db.insert(schema.components).values({
    id: componentId,
    publicId: PUBLIC_ID,
    slug: "test-button",
    ownerType: "platform",
    kind: "element",
    categoryId,
    name: "Test Button",
    displayName: { id: "Tombol Uji", en: "Test Button" },
    description: { id: "Dipakai di test", en: "Used in test" },
    status: "published",
    latestVersion: "1.0.0",
  });
  await testDb.db.insert(schema.componentVersions).values([
    // seq 1: published (terbaca). seq 2: draft (404). seq 3: published tapi yanked (404).
    { componentId, version: "1.0.0", versionSeq: 1, status: "published", definition: DEFINITION },
    { componentId, version: "2.0.0", versionSeq: 2, status: "draft", definition: DEFINITION },
    { componentId, version: "3.0.0", versionSeq: 3, status: "published", yanked: true, definition: DEFINITION },
    // CMP-044: seq 4 hash kanonik benar → 200; seq 5 hash salah → 500 (integritas).
    {
      componentId,
      version: "4.0.0",
      versionSeq: 4,
      status: "published",
      definition: DEFINITION,
      contentHash: stableHash(DEFINITION),
    },
    {
      componentId,
      version: "5.0.0",
      versionSeq: 5,
      status: "published",
      definition: DEFINITION,
      contentHash: "deadbeef",
    },
    // CMP-050: dua versi berbeda → read by version mengambil definisi EKSAK versi itu (pinned, bukan "latest").
    { componentId, version: "6.0.0", versionSeq: 6, status: "published", definition: { rootId: "n1", marker: 6 } },
    { componentId, version: "7.0.0", versionSeq: 7, status: "published", definition: { rootId: "n1", marker: 7 } },
  ]);
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
    .set("x-forwarded-for", `198.18.9.${(ipCounter++ % 250) + 1}`)
    .send(signUpBody(email));
  return sessionCookie(response.headers["set-cookie"]) ?? "";
}

const get = (cookie: string | null, path: string) => {
  const call = request(target).get(path).set("origin", TEST_ORIGIN);
  return cookie ? call.set("cookie", cookie) : call;
};

describe("GET /v1/library/components/:componentId/versions/:version", () => {
  it("versi published → 200 + definisi + Cache-Control immutable setahun", async () => {
    const cookie = await register();
    const response = await get(cookie, `/v1/library/components/${PUBLIC_ID}/versions/1`);
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(response.body.data).toMatchObject({ componentId: PUBLIC_ID, version: 1, semver: "1.0.0" });
    expect(response.body.data.definition).toEqual(DEFINITION);
  });

  it("CMP-044: hash kanonik cocok → 200; hash tak cocok (korupsi) → 500", async () => {
    const cookie = await register();
    expect((await get(cookie, `/v1/library/components/${PUBLIC_ID}/versions/4`)).status).toBe(200);
    expect((await get(cookie, `/v1/library/components/${PUBLIC_ID}/versions/5`)).status).toBe(500);
  });

  it("CMP-050: versi di-pin → read mengambil definisi EKSAK versi itu (bukan latest)", async () => {
    const cookie = await register();
    const v6 = await get(cookie, `/v1/library/components/${PUBLIC_ID}/versions/6`);
    const v7 = await get(cookie, `/v1/library/components/${PUBLIC_ID}/versions/7`);
    expect(v6.body.data.definition).toEqual({ rootId: "n1", marker: 6 });
    expect(v7.body.data.definition).toEqual({ rootId: "n1", marker: 7 });
  });

  it("versi draft / yanked / tidak ada → 404", async () => {
    const cookie = await register();
    expect((await get(cookie, `/v1/library/components/${PUBLIC_ID}/versions/2`)).status).toBe(404);
    expect((await get(cookie, `/v1/library/components/${PUBLIC_ID}/versions/3`)).status).toBe(404);
    expect((await get(cookie, `/v1/library/components/${PUBLIC_ID}/versions/99`)).status).toBe(404);
    expect((await get(cookie, "/v1/library/components/cmp_tidakada/versions/1")).status).toBe(404);
  });

  it("tanpa sesi → 401; componentId/versi tidak valid → 422", async () => {
    const cookie = await register();
    expect((await get(null, `/v1/library/components/${PUBLIC_ID}/versions/1`)).status).toBe(401);
    expect((await get(cookie, "/v1/library/components/bukan-id/versions/1")).status).toBe(422);
    expect((await get(cookie, `/v1/library/components/${PUBLIC_ID}/versions/0`)).status).toBe(422);
    expect((await get(cookie, `/v1/library/components/${PUBLIC_ID}/versions/abc`)).status).toBe(422);
  });
});
