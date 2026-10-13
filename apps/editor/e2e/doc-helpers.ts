import type { Locator, Page } from "@playwright/test";

type NodeEntry = [string, { get(key: string): unknown }];
type Spike = {
  doc: { getMap(name: string): { entries(): IterableIterator<NodeEntry> } };
  selection: { getState(): { selectedIds: readonly string[] } };
};

// ID node berdasarkan nama layer di fixture.
export async function idByName(page: Page, name: string): Promise<string> {
  const id = await page.evaluate((layerName) => {
    const nodes = (window as unknown as { __spike: Spike }).__spike.doc.getMap("nodes");
    for (const [id, node] of nodes.entries()) if (node.get("name") === layerName) return id;
    return null;
  }, name);
  if (!id) throw new Error(`node "${name}" tidak ada`);
  return id;
}

// Beberapa ID sekaligus, dipetakan per nama layer.
export async function idsByName<const N extends string>(page: Page, names: readonly N[]): Promise<Record<N, string>> {
  const entries = await Promise.all(names.map(async (name) => [name, await idByName(page, name)] as const));
  return Object.fromEntries(entries) as Record<N, string>;
}

export const selectedIds = (page: Page) =>
  page.evaluate(() => [...(window as unknown as { __spike: Spike }).__spike.selection.getState().selectedIds]);

export const nodeLocator = (page: Page, id: string): Locator => page.locator(`[data-node-id="${id}"]`);

export async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("elemen tidak terlihat");
  return box;
}
