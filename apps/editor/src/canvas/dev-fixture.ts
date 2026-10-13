import type { SiteDocument } from "@platform/document-model";
import {
  autolayoutDocument,
  freeformDocument,
  heroDocument,
  landing200,
  landing2000,
  minimalDocument,
  nestedDocument,
  wrapGridDocument,
} from "@platform/document-model/fixtures";

// SEMENTARA (spike M0): dokumen canvas dipilih lewat `?fixture=` sampai editor memuat dokumen
// dari server/Yjs (M1). Dipakai juga untuk cek manual & benchmark (T0.7.3).
const FIXTURES: Record<string, () => SiteDocument> = {
  hero: heroDocument,
  freeform: freeformDocument,
  autolayout: autolayoutDocument,
  wrap100: () => wrapGridDocument(100),
  nested: nestedDocument,
  minimal: minimalDocument,
  landing200,
  landing2000,
};

export const DEFAULT_FIXTURE = "landing200";

export function fixtureFromSearch(search: string): SiteDocument {
  const name = new URLSearchParams(search).get("fixture") ?? DEFAULT_FIXTURE;
  return (FIXTURES[name] ?? landing200)();
}
