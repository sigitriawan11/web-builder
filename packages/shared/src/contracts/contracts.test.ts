import { describe, expect, it } from "vitest";
import { z } from "zod";
import { uuidv7 } from "../ids";
import {
  CreateSiteBodySchema,
  CursorQuerySchema,
  DocumentMetaSchema,
  dataEnvelope,
  decodeCursor,
  ErrorBodySchema,
  encodeCursor,
  listEnvelope,
  parseJobPayload,
  parseRealtimeStatelessMessage,
  RealtimeTokenClaimsSchema,
  RealtimeTokenResponseSchema,
  SiteSchema,
  thumbnailJobId,
} from "./index";

const id = () => uuidv7();
const now = "2026-10-13T08:30:00.000Z";

function site() {
  return {
    id: id(),
    workspaceId: id(),
    name: "Toko Budi",
    status: "draft",
    documentId: id(),
    createdAt: now,
    updatedAt: now,
  };
}

describe("envelope response (ARCHITECTURE §5.3)", () => {
  it("contoh 200: `{ data, meta: { requestId } }`", () => {
    const body = { data: site(), meta: { requestId: id() } };
    expect(dataEnvelope(SiteSchema).parse(body)).toEqual(body);
  });

  it("contoh list: `{ data: [...], meta: { nextCursor, requestId } }`; halaman terakhir = nextCursor null", () => {
    const schema = listEnvelope(SiteSchema);
    const page = { data: [site(), site()], meta: { nextCursor: encodeCursor({ id: id() }), requestId: id() } };
    expect(schema.parse(page)).toEqual(page);
    expect(schema.parse({ data: [], meta: { nextCursor: null, requestId: "r1" } }).meta.nextCursor).toBeNull();
    expect(schema.safeParse({ data: [], meta: { requestId: "r1" } }).success).toBe(false);
  });

  it("contoh error (ARCHITECTURE §5.3 & spec 08 ACC-130) lolos ErrorBodySchema", () => {
    const body = {
      error: {
        code: "PLAN_LIMIT_REACHED",
        message: "Batas website untuk paket Starter sudah tercapai.",
        details: {
          key: "sites.max",
          used: 3,
          limit: 3,
          upgrade: { suggestedPlan: "pro", url: "/w/ws_abc/billing?upgrade=pro&reason=sites.max" },
        },
        requestId: id(),
      },
    };
    expect(ErrorBodySchema.parse(body)).toEqual(body);
  });

  it("kode error yang belum dikenal SDK lama tetap terbaca (Runtime API stabil); format kode tetap dicek", () => {
    const base = { message: "x", requestId: "r" };
    expect(ErrorBodySchema.safeParse({ error: { ...base, code: "KODE_BARU_DARI_SERVER" } }).success).toBe(true);
    expect(ErrorBodySchema.safeParse({ error: { ...base, code: "bukan-kode" } }).success).toBe(false);
  });
});

describe("cursor pagination", () => {
  const Position = z.object({ id: z.string(), name: z.string() });

  it("encode/decode bolak-balik, termasuk karakter non-ASCII, dan aman di URL", () => {
    const position = { id: id(), name: "Kue Lapis — ✓" };
    const cursor = encodeCursor(position);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(Position, cursor)).toEqual(position);
  });

  it("cursor rusak atau isinya tidak cocok schema → null, tidak melempar", () => {
    expect(decodeCursor(Position, "!!!bukan-base64")).toBeNull();
    expect(decodeCursor(Position, encodeCursor({ id: 1 }))).toBeNull();
    expect(decodeCursor(Position, encodeCursor("teks"))).toBeNull();
  });

  it("query: limit default 20, dari string query, dibatasi 1–100", () => {
    expect(CursorQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(CursorQuerySchema.parse({ limit: "50", cursor: "abc" })).toEqual({ limit: 50, cursor: "abc" });
    expect(CursorQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(CursorQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
  });
});

describe("DTO sites & documents", () => {
  it("site: status dibatasi; nama dirapikan saat dibuat", () => {
    expect(SiteSchema.safeParse({ ...site(), status: "deleted" }).success).toBe(false);
    expect(SiteSchema.safeParse({ ...site(), id: "123" }).success).toBe(false);
    expect(CreateSiteBodySchema.parse({ name: "  Toko Budi  " })).toEqual({ name: "Toko Budi" });
    expect(CreateSiteBodySchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("document: siteId null untuk dokumen library", () => {
    const doc = {
      id: id(),
      workspaceId: id(),
      siteId: null,
      kind: "component",
      schemaVersion: 1,
      lastSeq: 0,
      sizeBytes: 0,
      updatedAt: now,
    };
    expect(DocumentMetaSchema.parse(doc)).toEqual(doc);
  });
});

describe("realtime token (ARCHITECTURE §5.5)", () => {
  it("response berisi URL WebSocket; claims membawa userId, docId, siteId, role, exp", () => {
    expect(
      RealtimeTokenResponseSchema.safeParse({ token: "jwt", url: "wss://realtime.platformmu.com", expiresAt: now })
        .success,
    ).toBe(true);
    expect(RealtimeTokenResponseSchema.safeParse({ token: "jwt", url: "https://x", expiresAt: now }).success).toBe(
      false,
    );
    const claims = { sub: id(), docId: id(), siteId: id(), role: "editor", exp: 1_790_000_000 };
    expect(RealtimeTokenClaimsSchema.parse(claims)).toEqual(claims);
    expect(RealtimeTokenClaimsSchema.safeParse({ ...claims, role: "superuser" }).success).toBe(false);
  });
});

describe("stateless message realtime (ED-200, DM-076)", () => {
  it("saved & limit-warning ter-parse; payload asing/rusak → null", () => {
    const saved = { type: "saved", seq: 12, clocks: { "1234567": 40 } };
    expect(parseRealtimeStatelessMessage(JSON.stringify(saved))).toEqual(saved);
    const warning = { type: "limit-warning", limit: "yDocStateBytes", bytes: 9_000_000, max: 8_000_000 };
    expect(parseRealtimeStatelessMessage(JSON.stringify(warning))).toEqual(warning);
    expect(parseRealtimeStatelessMessage("saved:12")).toBeNull();
    expect(parseRealtimeStatelessMessage(JSON.stringify({ type: "saved", seq: -1, clocks: {} }))).toBeNull();
    expect(parseRealtimeStatelessMessage(JSON.stringify({ type: "saved", seq: 1, clocks: { abc: 1 } }))).toBeNull();
    expect(parseRealtimeStatelessMessage(JSON.stringify({ type: "lainnya" }))).toBeNull();
  });
});

describe("payload job (ARCHITECTURE §5.4)", () => {
  it("hanya ID + requestId; payload tanpa ID wajib ditolak", () => {
    const payload = { requestId: "req-1", siteId: id(), deploymentId: id() };
    expect(parseJobPayload("publish", payload)).toEqual(payload);
    expect(() => parseJobPayload("publish", { requestId: "req-1", siteId: id() })).toThrow();
    expect(() => parseJobPayload("thumbnails", { documentId: id(), snapshotId: id() })).toThrow();
  });

  it("jobId thumbnail untuk dedupe", () => {
    expect(thumbnailJobId("d1", "s1")).toBe("thumb:d1:s1");
  });
});
