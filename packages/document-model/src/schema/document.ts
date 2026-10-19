import { z } from "zod";
import { checkStructure } from "../validate/invariants";
import { NodeSchema } from "./nodes";
import { SiteSettingsSchema } from "./settings";
import { ThemeSchema } from "./theme";
import {
  AssetIdSchema,
  CollectionIdSchema,
  ComponentIdSchema,
  NodeIdSchema,
  PageIdSchema,
  TemplateIdSchema,
} from "./values";

// DM-004: info non-visual; TIDAK ada data tenant (userId/workspaceId/domain — DM-001).
export const SiteMetaSchema = z.strictObject({
  title: z.string().min(1),
  createdWith: z.enum(["blank", "template", "ai"]).optional(),
  templateRef: z.strictObject({ templateId: TemplateIdSchema, version: z.number().int().positive() }).optional(),
});

// "Lockfile" component (DM-004, DM-069): setiap instance merujuk versi yang tercatat di sini.
export const ComponentDepSchema = z.strictObject({
  version: z.number().int().positive(),
  source: z.enum(["library", "site", "marketplace"]),
});

// M7: hanya rujukan; schema collection ada di DB (spec 05).
export const DataSourcesSchema = z.strictObject({ collections: z.array(CollectionIdSchema) });

// DM-057: cache ringan metadata asset; URL tidak disimpan di dokumen (dibangun dari assetId + CDN + varian).
export const AssetEntrySchema = z.strictObject({
  kind: z.enum(["image", "video", "file", "font", "svg"]),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  mime: z.string().min(1),
  blurhash: z.string().optional(),
  libraryShared: z.boolean().optional(),
});

// Versi schema dokumen yang dihasilkan kode ini (spec 01 §19). Naik bersama fungsi migrasi + fixture test.
export const CURRENT_SCHEMA_VERSION = 6;

// DM-004 top-level. `localComponents` (P1) ditambah bersama fiturnya. Strict: key tak dikenal ditolak.
const SiteDocumentShapeSchema = z.strictObject({
  schemaVersion: z.number().int().positive(),
  meta: SiteMetaSchema,
  settings: SiteSettingsSchema,
  theme: ThemeSchema,
  assets: z.record(AssetIdSchema, AssetEntrySchema),
  componentDeps: z.record(ComponentIdSchema, ComponentDepSchema),
  dataSources: DataSourcesSchema.optional(),
  // Batas jumlah page (DM-076) diperiksa invariant `LIMITS` agar pesannya informatif.
  pageOrder: z.array(PageIdSchema).min(1),
  nodes: z.record(NodeIdSchema, NodeSchema),
});

type SiteDocumentShape = z.infer<typeof SiteDocumentShapeSchema>;

// Invariant struktur DM-069 (selalu error). Kode issue dibawa di `params.issueCode` (+ pesan EN) agar
// `validateDocument` bisa memetakannya; rujukan (asset/token/font/link) diperiksa `validateDocument` sesuai mode.
function checkInvariants(doc: SiteDocumentShape, ctx: z.RefinementCtx): void {
  checkStructure(doc, (issueCode, path, message, details) => {
    ctx.addIssue({ code: "custom", path, message: message.id, params: { issueCode, en: message.en, details } });
  });
}

export const SiteDocumentSchema = SiteDocumentShapeSchema.superRefine(checkInvariants);

export type SiteMeta = z.infer<typeof SiteMetaSchema>;
export type AssetEntry = z.infer<typeof AssetEntrySchema>;
export type ComponentDep = z.infer<typeof ComponentDepSchema>;
export type DataSources = z.infer<typeof DataSourcesSchema>;
export type SiteDocument = z.infer<typeof SiteDocumentSchema>;
