import { uuidv7 } from "@platform/shared";
import { expect, type Page, test } from "@playwright/test";
import { Redis } from "ioredis";
import pg from "pg";
import { APP_URL, E2E_DATABASE_URL, E2E_REDIS_URL } from "../playwright.config";
import { register } from "./support/auth";
import { resetRateLimits, uniqueEmail } from "./support/stack";

// T3.13.9 (AI-006/AI-027): panel chat Mode Admin. Admin kirim prompt → run dibuat → event di-stream (SSE) → Terapkan.
// Test ini berperan sbg worker mock: mem-publish event ke Redis stream run.
test.describe.configure({ mode: "serial" });
test.use({ locale: "en-US" });
test.beforeEach(resetRateLimits);

const STAFF_ROLE = "library_admin";

async function withDb<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

const definition = () => ({
  schemaVersion: 1,
  id: "cmp_aichattest",
  version: 1,
  name: "AI Chat Test",
  category: "card",
  propsSchema: [],
  rootId: "n_root0001",
  nodes: {
    n_root0001: {
      id: "n_root0001",
      type: "frame",
      name: "Root",
      parentId: null,
      visible: true,
      locked: false,
      tag: "div",
      children: [],
      style: { base: {} },
      props: {},
    },
  },
});

async function createComponentAsStaff(page: Page): Promise<string> {
  const email = uniqueEmail("ai-staff");
  await register(page, email);
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  await withDb((c) =>
    c.query("update users set staff_role = $1, email_verified = true where email = $2", [STAFF_ROLE, email]),
  );
  const categoryId = uuidv7();
  await withDb((c) =>
    c.query(`insert into library_categories (id, slug, scope, type, name) values ($1,$2,'component','functional',$3)`, [
      categoryId,
      `ai-cat-${categoryId}`,
      JSON.stringify({ id: "Uji", en: "Test" }),
    ]),
  );
  const created = await page.evaluate(
    async ({ categoryId, def, slug }) => {
      const res = await fetch("/api/v1/admin/library/components", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          categoryId,
          kind: "section",
          name: "AI Chat Test",
          displayName: { id: "AI Chat", en: "AI Chat" },
          description: { id: "d", en: "d" },
          definition: def,
        }),
      });
      return { status: res.status, body: (await res.json()) as { data?: { id: string } } };
    },
    { categoryId, def: definition(), slug: `ai-chat-${uuidv7()}` },
  );
  expect(created.status).toBe(201);
  return created.body.data?.id ?? "";
}

test("admin: kirim prompt → stream teks → Terapkan (AI-027)", async ({ page }) => {
  const componentId = await createComponentAsStaff(page);
  await page.goto(`${APP_URL}/editor/library/components/${componentId}/draft`);
  await expect(page.getByTestId("admin-badge")).toBeVisible();

  // Buka panel AI, kirim prompt.
  await page.getByTestId("ai-toggle").click();
  await expect(page.getByTestId("ai-panel")).toBeVisible();
  await page.getByTestId("ai-prompt").fill("buat 3 variasi hero");
  await page.getByTestId("ai-send").click();

  // Baca runId dari panel (data-run-id), lalu publish event sbg worker mock.
  const output = page.getByTestId("ai-output");
  await expect.poll(async () => (await output.getAttribute("data-run-id")) ?? "").not.toBe("");
  const runId = (await output.getAttribute("data-run-id")) ?? "";

  const redis = new Redis(E2E_REDIS_URL);
  try {
    const publish = async (event: string, data: unknown) => {
      const payload = JSON.stringify(data);
      const id = await redis.xadd(`airun-log:${runId}`, "*", "event", event, "data", payload);
      await redis.publish(`airun:${runId}`, JSON.stringify({ id, event, data: payload }));
    };
    await publish("text", { text: "Dibuat 3 variasi hero." });
    await publish("run.completed", {});
  } finally {
    redis.disconnect();
  }

  // Teks ter-stream + tombol Terapkan muncul.
  await expect(output).toContainText("Dibuat 3 variasi hero");
  await page.getByTestId("ai-apply").click();
  await expect(page.getByTestId("ai-decision")).toContainText("Applied"); // locale en-US

  // Draft status run = applied.
  const rows = await withDb((c) => c.query("select draft_status from ai_runs where id = $1", [runId]));
  expect(rows.rows[0]?.draft_status).toBe("applied");
});
