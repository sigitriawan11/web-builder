import { HocuspocusProvider } from "@hocuspocus/provider";
import type { Server } from "@hocuspocus/server";
import { uuidv7 } from "@platform/shared";
import { REALTIME_TOKEN_AUDIENCE, REALTIME_TOKEN_TTL_SECONDS } from "@platform/shared/contracts";
import { createLogger, signToken } from "@platform/shared/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";
import type { RealtimeContext } from "./auth";
import { createRealtimeServer } from "./server";

// T1.12.1: server Hocuspocus + onAuthenticate JWT (ARCHITECTURE §5.5) — token salah ditolak, docId harus cocok.
const SECRET = "test-realtime-secret-0123456789abcdef";
const logger = createLogger({ service: "realtime-test", env: "test", level: "silent" });
let server: Server<RealtimeContext>;
let url: string;

beforeAll(async () => {
  server = createRealtimeServer({ port: 0, host: "127.0.0.1", tokenSecret: SECRET, logger });
  await server.listen();
  url = `ws://127.0.0.1:${server.address.port}`;
});
afterAll(async () => {
  await server.destroy();
});

const userId = uuidv7();
const docId = uuidv7();
const siteId = uuidv7();

function token(
  overrides: {
    secret?: string;
    docId?: string;
    role?: string;
    audience?: string;
    expiresInSeconds?: number;
    now?: number;
  } = {},
) {
  return signToken(
    overrides.secret ?? SECRET,
    { sub: userId, docId: overrides.docId ?? docId, siteId, role: overrides.role ?? "editor" },
    {
      expiresInSeconds: overrides.expiresInSeconds ?? REALTIME_TOKEN_TTL_SECONDS,
      audience: overrides.audience ?? REALTIME_TOKEN_AUDIENCE,
      ...(overrides.now !== undefined ? { now: () => overrides.now as number } : {}),
    },
  );
}

type Outcome = { status: "ok"; scope: string } | { status: "failed"; reason: string };

/** Sambungkan provider; hasil autentikasi (lalu putus). */
function connect(tokenValue: string, name = docId): Promise<Outcome> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout menunggu autentikasi")), 5000);
    const provider = new HocuspocusProvider({
      url,
      name,
      token: tokenValue,
      document: new Y.Doc(),
      onAuthenticated: ({ scope }) => finish({ status: "ok", scope }),
      onAuthenticationFailed: ({ reason }) => finish({ status: "failed", reason }),
    });
    function finish(outcome: Outcome) {
      clearTimeout(timer);
      provider.destroy();
      resolve(outcome);
    }
  });
}

describe("onAuthenticate", () => {
  it("token valid untuk dokumen yang sama → tersambung read-write", async () => {
    expect(await connect(await token())).toEqual({ status: "ok", scope: "read-write" });
  });

  it("viewer → tersambung read-only", async () => {
    expect(await connect(await token({ role: "viewer" }))).toEqual({ status: "ok", scope: "readonly" });
  });

  it.each([
    ["secret salah", () => token({ secret: "secret-lain-yang-cukup-panjang-0123456789" })],
    ["kedaluwarsa", () => token({ now: Date.now() - (REALTIME_TOKEN_TTL_SECONDS + 60) * 1000 })],
    ["dokumen lain", () => token({ docId: uuidv7() })],
    ["audience salah", () => token({ audience: "api" })],
    ["bukan JWT", async () => "bukan-token"],
    ["kosong", async () => ""],
  ])("%s → ditolak (pesan generik)", async (_, make) => {
    const outcome = await connect(await make());
    expect(outcome.status).toBe("failed");
    expect(outcome).toMatchObject({ reason: "permission-denied" });
  });
});
