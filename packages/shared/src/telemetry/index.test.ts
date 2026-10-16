import { describe, expect, it } from "vitest";
import { type EventLike, scrubBreadcrumb, scrubEvent, stripUrl } from "./index";

// Teks dokumen user (judul, isi rich text, input form) yang TIDAK boleh sampai ke Sentry.
const SECRET = "Kue Lapis Legit Bu Sari — rahasia resep 0812-3456-7890";

const event = (overrides: Partial<EventLike> = {}): EventLike =>
  ({
    exception: { values: [{ type: "TypeError", value: "Cannot read properties of undefined" }] },
    tags: { site: "a1b2c3d4", area: "node" },
    contexts: {
      browser: { name: "Chrome" },
      state: { document: SECRET },
      react: { componentStack: "at NodeView" },
    },
    extra: { node: { props: { content: SECRET } } },
    user: { id: "hash123", email: "sari@contoh.id", ip_address: "10.0.0.1", username: SECRET },
    request: { url: `https://app.platformmu.com/editor/x?q=${encodeURIComponent(SECRET)}`, data: SECRET },
    breadcrumbs: [
      { category: "ui.click", message: `main > p[title="${SECRET}"]` },
      { category: "ui.input", message: SECRET },
      { category: "console", message: `Node invalid: ${SECRET}` },
      {
        category: "fetch",
        data: { method: "POST", url: `/api/v1/x?token=abc&t=${SECRET}`, body: SECRET, status_code: 200 },
      },
      { category: "navigation", data: { from: "/editor/a?page=pg_1", to: "/editor/a#frag" } },
      { category: "editor", data: { action: "undo", origin: "user", payload: SECRET } },
    ],
    ...overrides,
  }) as EventLike;

describe("scrubber Sentry browser (ED-231)", () => {
  it("AC: payload yang dikirim tidak memuat isi teks dokumen / input user", () => {
    const scrubbed = scrubEvent(event());
    expect(JSON.stringify(scrubbed)).not.toContain("Lapis");
    expect(JSON.stringify(scrubbed)).not.toContain("sari@contoh.id");
    expect(JSON.stringify(scrubbed)).not.toContain("10.0.0.1");
  });

  it("yang berguna untuk debugging tetap ada: exception, tag, konteks browser/react, user ter-hash, URL tanpa query", () => {
    const scrubbed = scrubEvent(event());
    expect((scrubbed.exception as { values: { type: string }[] }).values[0]?.type).toBe("TypeError");
    expect(scrubbed.tags).toEqual({ site: "a1b2c3d4", area: "node" });
    expect(Object.keys(scrubbed.contexts ?? {}).sort()).toEqual(["browser", "react"]);
    expect(scrubbed.user).toEqual({ id: "hash123" });
    expect(scrubbed.request).toEqual({ url: "https://app.platformmu.com/editor/x" });
    expect(scrubbed.breadcrumbs).toEqual([
      { category: "fetch", data: { method: "POST", status_code: 200, url: "/api/v1/x" } },
      { category: "navigation", data: { from: "/editor/a", to: "/editor/a" } },
      { category: "editor", data: { action: "undo", origin: "user" } },
    ]);
  });

  it("breadcrumb klik/input/console dibuang di sumbernya (beforeBreadcrumb)", () => {
    for (const category of ["ui.click", "ui.input", "console", "sentry.event"]) {
      expect(scrubBreadcrumb({ category, message: SECRET })).toBeNull();
    }
    expect(scrubBreadcrumb({ message: SECRET })).toBeNull();
  });

  it("ID mentah (UUID) di URL & nama transaksi diganti :id", () => {
    const id = "01a14398-46f8-77e4-b1d9-ab7ef2dee821";
    const scrubbed = scrubEvent(
      event({ request: { url: `http://app.localhost:3000/editor/${id}` }, transaction: `/editor/${id}` }),
    );
    expect(JSON.stringify(scrubbed)).not.toContain(id);
    expect(scrubbed.request?.url).toBe("http://app.localhost:3000/editor/:id");
    expect(scrubbed.transaction).toBe("/editor/:id");
  });

  it("stripUrl membuang query & fragment", () => {
    expect(stripUrl("/a/b?c=1#d")).toBe("/a/b");
    expect(stripUrl("/a#b?c")).toBe("/a");
    expect(stripUrl("/a")).toBe("/a");
  });
});
