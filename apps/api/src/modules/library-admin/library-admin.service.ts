import { createHash } from "node:crypto";
import type { Db } from "@platform/db";
import { createId, validateComponentDefinition } from "@platform/document-model";
import { AppError, uuidv7 } from "@platform/shared";
import type { LibraryEditorSession } from "@platform/shared/contracts";
import type { Logger } from "@platform/shared/node";
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

const contentHash = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Semver berikut dari versi published terakhir + bump. Null (belum pernah publish) → basis 0.0.0. */
function bumpSemver(current: string | null, bump: PublishInput["bump"]): string {
  const [major = 0, minor = 0, patch = 0] = (current ?? "0.0.0").split(".").map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function validateDefinition(input: unknown): Record<string, unknown> {
  const result = validateComponentDefinition(input);
  if (!result.ok || !result.definition) {
    throw new AppError("VALIDATION_FAILED", undefined, { issues: result.issues });
  }
  return result.definition as unknown as Record<string, unknown>;
}

export function createLibraryAdminService(deps: { db: Db; logger: Logger }) {
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
    /** Buat component platform + draft versi pertama (CMP-011/CMP-159). */
    async createComponent(actor: StaffActor, input: CreateInput): Promise<{ id: string; publicId: string }> {
      const definition = validateDefinition(input.definition);
      const id = uuidv7();
      const publicId = createId("cmp");
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
        const versionId = await repo.insertVersion(tx, {
          componentId: id,
          status: "draft",
          definition,
          contentHash: contentHash(definition),
          createdBy: actor.userId,
        });
        await repo.updateComponent(tx, id, { draftVersionId: versionId });
      });
      await audit(actor, "library_component.create", id, { publicId, slug: input.slug });
      return { id, publicId };
    },

    /** Simpan draft: definisi (divalidasi) dan/atau metadata. Hanya baris draft yang di-UPDATE (trigger immutable). */
    async saveDraft(actor: StaffActor, componentId: string, input: SaveDraftInput): Promise<void> {
      const component = await repo.findComponent(db, componentId);
      if (!component) throw new AppError("NOT_FOUND");
      if (input.definition !== undefined && !component.draftVersionId) {
        throw new AppError("CONFLICT", undefined, { reason: "no_draft" });
      }
      const definition = input.definition !== undefined ? validateDefinition(input.definition) : undefined;
      await withTransaction(db, logger, async (tx) => {
        if (definition && component.draftVersionId) {
          await repo.updateVersion(tx, component.draftVersionId, {
            definition,
            contentHash: contentHash(definition),
          });
        }
        const meta: Partial<repo.ComponentInsert> = {};
        if (input.name !== undefined) meta.name = input.name;
        if (input.displayName !== undefined) meta.displayName = input.displayName;
        if (input.description !== undefined) meta.description = input.description;
        if (input.tags !== undefined) meta.tags = input.tags;
        if (input.keywords !== undefined) meta.keywords = input.keywords;
        if (input.industries !== undefined) meta.industries = input.industries;
        if (input.aiHints !== undefined) meta.aiHints = input.aiHints;
        if (input.minPlan !== undefined) meta.minPlan = input.minPlan;
        if (Object.keys(meta).length > 0) await repo.updateComponent(tx, componentId, meta);
      });
      await audit(actor, "library_component.draft_save", componentId, {
        definitionChanged: definition !== undefined,
      });
    },

    /**
     * Publish draft sebagai versi baru. Satu transaksi (CMP-159 AC-2): draft → published (versi + version_seq),
     * update pointer `latest_*`, kosongkan draft. Enqueue thumbnail/notify menyusul saat job-nya ada (M4).
     */
    async publish(
      actor: StaffActor,
      componentId: string,
      input: PublishInput,
    ): Promise<{ version: string; versionSeq: number }> {
      const component = await repo.findComponent(db, componentId);
      if (!component) throw new AppError("NOT_FOUND");
      if (!component.draftVersionId) throw new AppError("CONFLICT", undefined, { reason: "no_draft" });
      const draft = await repo.findVersion(db, component.draftVersionId);
      if (draft?.status !== "draft") throw new AppError("CONFLICT", undefined, { reason: "no_draft" });

      const version = bumpSemver(component.latestVersion, input.bump);
      const versionSeq = (await repo.maxVersionSeq(db, componentId)) + 1;
      await withTransaction(db, logger, async (tx) => {
        await repo.updateVersion(tx, draft.id, {
          status: "published",
          version,
          versionSeq,
          bump: input.bump,
          changelog: input.changelog,
        });
        await repo.updateComponent(tx, componentId, {
          status: "published",
          latestVersionId: draft.id,
          latestVersion: version,
          draftVersionId: null,
        });
      });
      await audit(actor, "library_component.publish", componentId, { version, versionSeq, bump: input.bump });
      return { version, versionSeq };
    },

    /** Deprecate: tetap bisa dipakai instance lama, disembunyikan dari galeri; `replacedBy` untuk saran migrasi. */
    async deprecate(actor: StaffActor, componentId: string, input: DeprecateInput): Promise<void> {
      const component = await repo.findComponent(db, componentId);
      if (!component) throw new AppError("NOT_FOUND");
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
      await repo.updateComponent(db, componentId, { status: "archived", archivedAt: new Date() });
      await audit(actor, "library_component.archive", componentId, {});
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
        component: {
          id: component.id,
          publicId: component.publicId,
          kind: component.kind,
          name: component.name,
          displayName: component.displayName,
          description: component.description,
          status: component.status,
          latestVersion: component.latestVersion,
          hasDraft: component.draftVersionId !== null,
        },
        capabilities: capabilitiesFor(role),
      };
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
