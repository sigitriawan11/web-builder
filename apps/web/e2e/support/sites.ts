import type { Page } from "@playwright/test";

/** Buat situs kosong lewat api (sesi browser saat ini) — setup cepat test editor. */
export async function createSiteViaApi(page: Page, name: string): Promise<string> {
  return page.evaluate(async (siteName) => {
    const workspaces = (await (await fetch("/api/v1/workspaces")).json()) as { data: { id: string }[] };
    const response = await fetch(`/api/v1/workspaces/${workspaces.data[0]?.id}/sites`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: siteName }),
    });
    return ((await response.json()) as { data: { id: string } }).data.id;
  }, name);
}
