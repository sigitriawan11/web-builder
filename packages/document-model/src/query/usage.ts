import type { SiteDocument } from "../schema";
import { pageOf } from "./tree";

// Read model pemakaian component (CMP-051/CMP-156): hitung ulang `(componentId, version, instanceCount)` per situs
// dari dokumen. Murni & deterministik — dipakai proyeksi realtime (draft) & pipeline publish (published).

export interface ComponentUsageEntry {
  // ID yang dirujuk dokumen (`cmp_…`, = components.public_id). Pemanggil (repository) memetakan ke UUID + versi.
  componentId: string;
  // `version_seq` (integer) yang di-pin instance.
  version: number;
  instanceCount: number;
  // Halaman (page id) yang memuat instance ini, urut & unik.
  pageIds: string[];
  hasOverrides: boolean;
}

/** Semua instance di dokumen (termasuk di dalam slot & nested), dikelompokkan per `componentId@version`. */
export function collectComponentUsage(doc: Pick<SiteDocument, "nodes">): ComponentUsageEntry[] {
  const byKey = new Map<string, ComponentUsageEntry & { pages: Set<string> }>();
  for (const node of Object.values(doc.nodes)) {
    if (node.type !== "instance") continue;
    const { componentId, version, overrides } = node.props;
    const key = `${componentId}@${version}`;
    const entry = byKey.get(key) ?? {
      componentId,
      version,
      instanceCount: 0,
      pageIds: [],
      hasOverrides: false,
      pages: new Set<string>(),
    };
    entry.instanceCount += 1;
    if (overrides && Object.keys(overrides).length > 0) entry.hasOverrides = true;
    // Isi slot ber-parent instance, jadi parentId tetap menuntun ke page (DM-019).
    const page = pageOf(doc, node.id);
    if (page) entry.pages.add(page);
    byKey.set(key, entry);
  }
  return [...byKey.values()]
    .map(({ pages, ...rest }) => ({ ...rest, pageIds: [...pages].sort() }))
    .sort((a, b) => (a.componentId === b.componentId ? a.version - b.version : a.componentId < b.componentId ? -1 : 1));
}
