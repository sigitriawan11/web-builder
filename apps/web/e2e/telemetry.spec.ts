import { createServer, type Server } from "node:http";
import { gunzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import { APP_URL, SENTRY_E2E_ORIGIN, SENTRY_E2E_PORT } from "../playwright.config";

// T1.16.3: Sentry apps/web — error browser (dicegat `page.route`) & error render server (`onRequestError` → server
// penampung lokal di port DSN e2e). Editor diuji di document.spec; api/worker/realtime lewat unit test transport.
test.describe.configure({ mode: "serial" });
test.use({ locale: "en-US" });

let ingest: Server;
const serverEnvelopes: string[] = [];

test.beforeAll(async () => {
  ingest = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks);
      serverEnvelopes.push((request.headers["content-encoding"] === "gzip" ? gunzipSync(body) : body).toString());
      response.writeHead(200).end("{}");
    });
  });
  await new Promise<void>((resolve) => ingest.listen(SENTRY_E2E_PORT, "127.0.0.1", resolve));
});

test.afterAll(async () => {
  await new Promise((resolve) => ingest.close(resolve));
});

test("error browser web → event Sentry ber-tag service web, URL tanpa query", async ({ page }) => {
  const envelopes: string[] = [];
  await page.route(`${SENTRY_E2E_ORIGIN}/**`, async (route) => {
    envelopes.push(route.request().postData() ?? "");
    await route.fulfill({ status: 200, body: "{}", headers: { "access-control-allow-origin": "*" } });
  });
  await page.goto(`${APP_URL}/login?next=%2Fsites%3Ftoken%3Drahasia`);
  await page.getByLabel("Email").fill("rahasia@contoh.id");
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error("e2e: kesalahan browser web disengaja");
    });
  });
  await expect
    .poll(() => envelopes.find((body) => body.includes("kesalahan browser web disengaja")) ?? "")
    .toContain('"service":"web"');
  const event = envelopes.find((body) => body.includes("kesalahan browser web disengaja")) ?? "";
  expect(event).toContain('"environment":"e2e"');
  expect(event).not.toContain("rahasia");
});

test("error render server web → onRequestError → event Sentry ber-tag rute & request_id", async ({ page }) => {
  await page.goto(`${APP_URL}/dev/error`);
  await expect
    .poll(() => serverEnvelopes.find((body) => body.includes("kesalahan server web disengaja")) ?? "", {
      timeout: 15_000,
    })
    .toContain('"service":"web"');
  const event = serverEnvelopes.find((body) => body.includes("kesalahan server web disengaja")) ?? "";
  expect(event).toContain('"route_type":"render"');
  expect(event).toMatch(/"request_id":"[^"]+"/);
  expect(event).toContain('"path":"/dev/error"');
});
