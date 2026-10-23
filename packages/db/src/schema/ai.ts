import { bigint, boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { bytea, id, identityId, timestamps } from "../columns";
import { users } from "./identity";
import { sites } from "./sites";
import { workspaces } from "./workspaces";

// AI agent (spec 04, ARCHITECTURE §6.3/§10). Percakapan + run (fork Y.Doc draft) + pesan + tool call. Schema & migration
// HANYA di packages/db (CLAUDE.md §Database). `base_state_vector`/draft biner tak disimpan di sini (draft di R2/MinIO,
// `draft_ref`); `base_state_vector` bytea untuk apply (DM-060). Tabel append-only bervolume tinggi = `bigint identity`.

export const aiRunKindEnum = pgEnum("ai_run_kind", [
  "inline",
  "chat",
  "plan",
  "onboarding",
  "dynamic",
  "commerce",
  "admin",
]);
export const aiRunStatusEnum = pgEnum("ai_run_status", [
  "queued",
  "running",
  "waiting_user",
  "waiting_confirmation",
  "completed",
  "failed",
  "cancelled",
  "expired",
]);
export const aiDraftStatusEnum = pgEnum("ai_draft_status", ["pending", "applied", "discarded", "partially_applied"]);
export const aiMessageRoleEnum = pgEnum("ai_message_role", ["user", "assistant"]);
export const aiToolStatusEnum = pgEnum("ai_tool_status", ["ok", "error", "declined"]);

// AI-050: thread percakapan per situs/user. `summary` diperbarui tier-small di akhir tiap run (AI-043).
export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: id(),
    siteId: uuid()
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text(),
    summary: text(),
    ...timestamps,
    deletedAt: timestamp({ withTimezone: true }),
  },
  (table) => [index("ai_conversations_site_idx").on(table.siteId, table.userId)],
);

// AI-040: satu run agent (fork Y.Doc per run, origin `ai:<runId>`). Kolom agregat token/kredit (AI-160/AI-107).
export const aiRuns = pgTable(
  "ai_runs",
  {
    id: id(),
    conversationId: uuid().references(() => aiConversations.id, { onDelete: "set null" }),
    siteId: uuid().references(() => sites.id, { onDelete: "cascade" }),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    workspaceId: uuid().references(() => workspaces.id, { onDelete: "cascade" }),
    kind: aiRunKindEnum().notNull(),
    status: aiRunStatusEnum().notNull().default("queued"),
    draftStatus: aiDraftStatusEnum(),
    modelTier: text(),
    modelId: text(),
    skillBundleVersion: text(),
    promptVersion: text(),
    iterations: integer().notNull().default(0),
    inputTokens: bigint({ mode: "number" }).notNull().default(0),
    outputTokens: bigint({ mode: "number" }).notNull().default(0),
    cacheReadTokens: bigint({ mode: "number" }).notNull().default(0),
    cacheWriteTokens: bigint({ mode: "number" }).notNull().default(0),
    toolCalls: integer().notNull().default(0),
    renders: integer().notNull().default(0),
    creditsReserved: bigint({ mode: "number" }).notNull().default(0),
    creditsCharged: bigint({ mode: "number" }).notNull().default(0),
    creditsRefunded: bigint({ mode: "number" }).notNull().default(0),
    baseStateVector: bytea(),
    draftRef: text(),
    touchedNodeIds: jsonb().$type<string[]>().notNull().default([]),
    errorCode: text(),
    startedAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("ai_runs_conversation_idx").on(table.conversationId), index("ai_runs_site_idx").on(table.siteId)],
);

// AI-050: pesan user/assistant (teks + ref lampiran). Append-only, bervolume → bigint identity.
export const aiMessages = pgTable(
  "ai_messages",
  {
    id: identityId(),
    conversationId: uuid()
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    runId: uuid().references(() => aiRuns.id, { onDelete: "set null" }),
    role: aiMessageRoleEnum().notNull(),
    content: jsonb().$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_messages_conversation_idx").on(table.conversationId, table.id)],
);

// AI-107/AI-160: jejak tiap tool call (input diredaksi, output ringkas). Append-only, bervolume → bigint identity.
export const aiToolCalls = pgTable(
  "ai_tool_calls",
  {
    id: identityId(),
    runId: uuid()
      .notNull()
      .references(() => aiRuns.id, { onDelete: "cascade" }),
    seq: integer().notNull(),
    tool: text().notNull(),
    input: jsonb().$type<Record<string, unknown>>(),
    outputSummary: jsonb().$type<Record<string, unknown>>(),
    status: aiToolStatusEnum().notNull(),
    errorCode: text(),
    durationMs: integer(),
    commandsCount: integer().notNull().default(0),
    destructive: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_tool_calls_run_idx").on(table.runId, table.seq)],
);
