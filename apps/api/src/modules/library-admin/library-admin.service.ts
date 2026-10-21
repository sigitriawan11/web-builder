import type { Db } from "@platform/db";
import {
  type ComponentDefinition,
  CURRENT_COMPONENT_SCHEMA_VERSION,
  componentDefFromState,
  componentDefToState,
  createId,
  diffComponentSchemas,
  validateComponentDefinition,
} from "@platform/document-model";
import { AppError, uuidv7 } from "@platform/shared";
import {
  type LibraryComponentSummary,
  type LibraryEditorSession,
  REALTIME_TOKEN_AUDIENCE,
  REALTIME_TOKEN_TTL_SECONDS,
  type RealtimeTokenResponse,
} from "@platform/shared/contracts";
import { type Logger, signToken, stableHash } from "@platform/shared/node";
import type { z } from "zod";
import { recordAudit } from "../../audit/audit.repository";
import { findStaffRole, type StaffRole } from "../../middleware/staff.repository";
import { withTransaction } from "../../queues/with-transaction";
import * as repo from "./library-admin.repository";
import type {
  archiveRequest,
  createComponentRequest,
  deprecateRequest,
  publishRequest,
  saveDraftRequest,
} from "./library-admin.schema";
import { assertComponentTransition } from "./library-admin.status";

// Aktor + jejak untuk audit_logs (CMP-159 AC-1: setiap aksi admin tercatat).
export interface StaffActor {
  userId: string;
  ip?: string;
  userAgent?: string;
}

type CreateInput = z.infer<typeof createComponentRequest.body>;
type SaveDraftInput = z.infer<typeof saveDraftRequest.body>;
type PublishInput = z.infer<typeof publishRequest.body>;
type DeprecateInput = z.infer<typeof deprecateRequest.body>;
type ArchiveInput = z.infer<NonNullable<typeof archiveRequest.body>>;

// CMP-044: hash kanonik (key terurut) → stabil lintas round-trip jsonb saat verifikasi integritas load.
const contentHash = (value: unknown): string => stableHash(value);

// Urutan keparahan bump (CMP-042) — bump yang diminta tak boleh < yang terdeteksi.
const BUMP_ORDER: Record<"patch" | "minor" | "major", number> = { patch: 0, minor: 1, major: 2 };

/** Semver berikut dari versi published terakhir + bump. Null (belum pernah publish) → basis 0.0.0. */
function bumpSemver(current: string | null, bump: PublishInput["bump"]): string {
  const [major = 0, minor = 0, patch = 0] = (current ?? "0.0.0").split(".").map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function validateDefinition(input: unknown): ComponentDefinition {
  const result = validateComponentDefinition(input);
  if (!result.ok || !result.definition) {
    throw new AppError("VALIDATION_FAILED", undefined, { issues: result.issues });
  }
  return result.definition;
}

// ComponentDefinition → kolom jsonb (`component_versions.definition`, `$type<Record<string,unknown>>`).
const asJsonb = (def: ComponentDefinition): Record<string, unknown> => def as unknown as Record<string, unknown>;

// Baris `components` → DTO summary panel Mode Admin (CMP-010/CMP-013).
function componentSummary(component: repo.ComponentRow): LibraryComponentSummary {
  return {
    id: component.id,
    publicId: component.publicId,
    kind: component.kind,
    name: component.name,
    displayName: component.displayName,
    description: component.description,
    status: component.status,
    latestVersion: component.latestVersion,
    hasDraft: component.draftDocumentId !== null,
    draftDocumentId: component.draftDocumentId,
    categoryId: component.categoryId,
    tags: component.tags,
    keywords: component.keywords,
    industries: component.industries,
    aiHints: component.aiHints,
    requiresFeatures: component.requiresFeatures as LibraryComponentSummary["requiresFeatures"],
  };
}

export function createLibraryAdminService(deps: {
  db: Db;
  logger: Logger;
  // Konfigurasi realtime untuk token editor draft component (D3). Tanpa ini, endpoint token tidak dipasang.
  realtime?: { tokenSecret: string; url: string; now?: () => number };
}) {
  const { db, logger } = deps;

  async function audit(actor: StaffActor, action: string, componentId: string, metadata: Record<string, unknown>) {
    await recordAudit(db, {
      actorType: "staff",
      actorId: actor.userId,
      action,
      targetType: "library_component",
      targetId: componentId,
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
      metadata,
    });
  }

  return {
    /** Buat component platform + draft sebagai dokumen Yjs `kind='component'` (CMP-010/CMP-011, Approach A). */
    async createComponent(actor: StaffActor, input: CreateInput): Promise<{ id: string; publicId: string }> {
      const id = uuidv7();
      const publicId = createId("cmp");
      // Samakan `definition.id` dengan public_id yang di-generate (DM-018): id yang dirujuk dokumen/instance = public_id.
      const definition: ComponentDefinition = { ...validateDefinition(input.definition), id: publicId };
      await withTransaction(db, logger, async (tx) => {
        await repo.insertComponent(tx, {
          id,
          publicId,
          slug: input.slug,
          ownerType: "platform",
          kind: input.kind,
          categoryId: input.categoryId,
          name: input.name,
          displayName: input.displayName,
          description: input.description,
          ...(input.tags ? { tags: input.tags } : {}),
          ...(input.keywords ? { keywords: input.keywords } : {}),
          ...(input.industries ? { industries: input.industries } : {}),
          ...(input.aiHints ? { aiHints: input.aiHints } : {}),
          ...(input.minPlan ? { minPlan: input.minPlan } : {}),
          status: "draft",
          createdBy: actor.userId,
        });
        const draftDocumentId = await repo.createComponentDraftDocument(tx, {
          schemaVersion: CURRENT_COMPONENT_SCHEMA_VERSION,
          state: componentDefToState(definition),
          json: asJsonb(definition),
          createdBy: actor.userId,
        });
        await repo.updateComponent(tx, id, { draftDocumentId });
      });
      await audit(actor, "library_component.create", id, { publicId, slug: input.slug });
      return { id, publicId };
    },

    /** Simpan metadata draft (name/displayName/tags/…). Definisi diedit lewat Yjs/realtime (Approach A), bukan di sini. */
    async saveDraft(actor: StaffActor, componentId: string, input: SaveDraftInput): Promise<void> {
      const component = await repo.findComponent(db, componentId);
      if (!component) throw new AppError("NOT_FOUND");
      const meta: Partial<repo.ComponentInsert> = {};
      if (input.name !== undefined) meta.name = input.name;
      if (input.displayName !== undefined) meta.displayName = input.displayName;
      if (input.description !== undefined) meta.description = input.description;
      if (input.categoryId !== undefined) meta.categoryId = input.categoryId;
      if (input.tags !== undefined) meta.tags = input.tags;
      if (input.keywords !== undefined) meta.keywords = input.keywords;
      if (input.industries !== undefined) meta.industries = input.industries;
      if (input.aiHints !== undefined) meta.aiHints = input.aiHints;
      if (input.requiresFeatures !== undefined) meta.requiresFeatures = input.requiresFeatures;
      if (input.minPlan !== undefined) meta.minPlan = input.minPlan;
      if (Object.keys(meta).length > 0) await repo.updateComponent(db, componentId, meta);
      await audit(actor, "library_component.draft_save", componentId, { fields: Object.keys(meta) });
    },

    /**
     * Publish: baca draft Y.Doc (D5) → ComponentDefinition → validasi → INSERT `component_versions` (immutable) + naikkan
     * pointer `latest_*`, satu transaksi (CMP-159 AC-2). Draft tetap (lanjut edit versi berikutnya). Thumbnail/notify M4.
     */
    async publish(
      actor: StaffActor,
      componentId: string,
      input: PublishInput,
    ): Promise<{ version: string; versionSeq: number }> {
      const component = await repo.findComponent(db, componentId);
      if (!component) throw new AppError("NOT_FOUND");
      if (!component.draftDocumentId) throw new AppError("CONFLICT", undefined, { reason: "no_draft" });
      const draftState = await repo.loadDraftDocumentState(db, component.draftDocumentId);
      if (!draftState) throw new AppError("CONFLICT", undefined, { reason: "no_draft" });
      // Draft dari Yjs bisa belum selesai/tidak valid → 422 dengan issues (bukan 500).
      const definition = validateDefinition(componentDefFromState(draftState.state));

      // CMP-042: admin tak boleh menurunkan bump yang terdeteksi (breaking tak bisa dipublish sbg minor/patch).
      if (component.latestVersionId) {
        const prev = await repo.findVersion(db, component.latestVersionId);
        if (prev) {
          const detected = diffComponentSchemas(prev.definition as unknown as ComponentDefinition, definition).bump;
          if (BUMP_ORDER[input.bump] < BUMP_ORDER[detected])
            throw new AppError("CONFLICT", undefined, { reason: "bump_too_low", detected, requested: input.bump });
        }
      }

      const version = bumpSemver(component.latestVersion, input.bump);
      const versionSeq = (await repo.maxVersionSeq(db, componentId)) + 1;
      await withTransaction(db, logger, async (tx) => {
        const versionId = await repo.insertVersion(tx, {
          componentId,
          status: "published",
          version,
          versionSeq,
          bump: input.bump,
          definition: asJsonb(definition),
          contentHash: contentHash(definition),
          changelog: input.changelog,
          createdBy: actor.userId,
        });
        await repo.updateComponent(tx, componentId, {
          status: "published",
          latestVersionId: versionId,
          latestVersion: version,
        });
      });
      await audit(actor, "library_component.publish", componentId, { version, versionSeq, bump: input.bump });
      return { version, versionSeq };
    },

    /** Deprecate: tetap bisa dipakai instance lama, disembunyikan dari galeri; `replacedBy` untuk saran migrasi. */
    async deprecate(actor: StaffActor, componentId: string, input: DeprecateInput): Promise<void> {
      const component = await repo.findComponent(db, componentId);
      if (!component) throw new AppError("NOT_FOUND");
      assertComponentTransition(component.status, "deprecated"); // CMP-040: hanya dari published.
      await repo.updateComponent(db, componentId, {
        status: "deprecated",
        deprecatedAt: new Date(),
        ...(input.replacedBy ? { replacedByComponentId: input.replacedBy } : {}),
      });
      await audit(actor, "library_component.deprecate", componentId, {
        ...(input.replacedBy ? { replacedBy: input.replacedBy } : {}),
      });
    },

    /** Archive: tidak bisa diinsert ke situs baru. */
    async archive(actor: StaffActor, componentId: string, _input: ArchiveInput): Promise<void> {
      const component = await repo.findComponent(db, componentId);
      if (!component) throw new AppError("NOT_FOUND");
      assertComponentTransition(component.status, "archived"); // CMP-040: hanya dari deprecated.
      await repo.updateComponent(db, componentId, { status: "archived", archivedAt: new Date() });
      await audit(actor, "library_component.archive", componentId, {});
    },

    /** Daftar kategori library (CMP-150) untuk picker create-from-selection. */
    async listCategories(): Promise<repo.CategoryRow[]> {
      return repo.listComponentCategories(db);
    },

    /** Pemakaian per versi/docState (CMP-159 GET usage). */
    async usage(componentId: string): Promise<repo.UsageRow[]> {
      const component = await repo.findComponent(db, componentId);
      if (!component) throw new AppError("NOT_FOUND");
      return repo.usageByComponent(db, componentId);
    },

    /** Bootstrap sesi editor Mode Admin (CMP-010): metadata + kapabilitas user dari `users.staff_role`. */
    async getEditorSession(actor: StaffActor, componentId: string): Promise<LibraryEditorSession> {
      const component = await repo.findComponent(db, componentId);
      if (!component) throw new AppError("NOT_FOUND");
      const role = await findStaffRole(db, actor.userId);
      // requireStaffRole sudah menolak non-staf; `role` di sini pasti terisi.
      if (!role) throw new AppError("NOT_FOUND");
      return {
        component: componentSummary(component),
        capabilities: capabilitiesFor(role),
      };
    },

    /**
     * Token realtime 5 menit untuk draft Y.Doc component (D3, endpoint admin terpisah). Role staf → kapabilitas:
     * bisa edit → `editor`, read-only (`staff`) → `viewer` (logika read-only realtime berlaku tanpa perubahan).
     */
    async issueRealtimeToken(actor: StaffActor, componentId: string): Promise<RealtimeTokenResponse> {
      const realtime = deps.realtime;
      if (!realtime) throw new AppError("INTERNAL_ERROR", undefined, { reason: "realtime_not_configured" });
      const component = await repo.findComponent(db, componentId);
      if (!component) throw new AppError("NOT_FOUND");
      if (!component.draftDocumentId) throw new AppError("CONFLICT", undefined, { reason: "no_draft" });
      const role = await findStaffRole(db, actor.userId);
      if (!role) throw new AppError("NOT_FOUND");
      const nowMs = realtime.now?.() ?? Date.now();
      const token = await signToken(
        realtime.tokenSecret,
        {
          sub: actor.userId,
          docId: component.draftDocumentId,
          siteId: null,
          role: capabilitiesFor(role).canEditDraft ? ("editor" as const) : ("viewer" as const),
          kind: "component" as const,
        },
        { expiresInSeconds: REALTIME_TOKEN_TTL_SECONDS, audience: REALTIME_TOKEN_AUDIENCE, now: () => nowMs },
      );
      const expiresAt = new Date((Math.floor(nowMs / 1000) + REALTIME_TOKEN_TTL_SECONDS) * 1000).toISOString();
      return { token, url: realtime.url, expiresAt };
    },

    /**
     * Definisi DRAFT terkini (CMP-011/Option A) by public_id — registry editor me-resolve instance draft (version 0).
     * Dibaca dari Y.Doc draft (sama seperti publish, tanpa membuat versi). Tak ada draft / tak valid → 404/422.
     */
    async getDraftDefinition(publicId: string): Promise<{ componentId: string; definition: ComponentDefinition }> {
      const component = await repo.findComponentByPublicId(db, publicId);
      if (!component?.draftDocumentId) throw new AppError("NOT_FOUND");
      const draftState = await repo.loadDraftDocumentState(db, component.draftDocumentId);
      if (!draftState) throw new AppError("NOT_FOUND");
      return { componentId: publicId, definition: validateDefinition(componentDefFromState(draftState.state)) };
    },
  };
}

// CMP-010 §tabel role: designer/library_admin/super_admin boleh edit draft; publish hanya library_admin/super_admin;
// `staff` = read-only.
function capabilitiesFor(role: StaffRole): LibraryEditorSession["capabilities"] {
  const canEditDraft = role === "designer" || role === "library_admin" || role === "super_admin";
  const canPublish = role === "library_admin" || role === "super_admin";
  return { role, canEditDraft, canPublish };
}

export type LibraryAdminService = ReturnType<typeof createLibraryAdminService>;
