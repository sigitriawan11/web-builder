import { HocuspocusProvider } from "@hocuspocus/provider";
import {
  parseRealtimeStatelessMessage,
  REALTIME_TOKEN_AUDIENCE,
  type RealtimeStatelessMessage,
} from "@platform/shared/contracts";
import { signToken } from "@platform/shared/node";
import * as Y from "yjs";

// Klien Hocuspocus asli untuk integration test realtime.

export interface TestClient {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  stateless: string[];
  messages<T extends RealtimeStatelessMessage["type"]>(type: T): Extract<RealtimeStatelessMessage, { type: T }>[];
  send(message: unknown): void;
}

export interface ConnectOptions {
  url: string;
  secret: string;
  userId: string;
  docId: string;
  siteId: string | null;
  role?: "owner" | "editor" | "viewer";
  kind?: "site" | "component";
}

export async function connectClient(options: ConnectOptions): Promise<TestClient> {
  const token = await signToken(
    options.secret,
    {
      sub: options.userId,
      docId: options.docId,
      siteId: options.siteId,
      role: options.role ?? "owner",
      kind: options.kind ?? "site",
    },
    { expiresInSeconds: 300, audience: REALTIME_TOKEN_AUDIENCE },
  );
  const doc = new Y.Doc();
  const stateless: string[] = [];
  const provider = await new Promise<HocuspocusProvider>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("tidak tersinkron")), 5000);
    const created: HocuspocusProvider = new HocuspocusProvider({
      url: options.url,
      name: options.docId,
      token,
      document: doc,
      onStateless: ({ payload }) => stateless.push(payload),
      onSynced: () => {
        clearTimeout(timer);
        resolve(created);
      },
    });
  });
  return {
    doc,
    provider,
    stateless,
    messages: (type) =>
      stateless
        .map(parseRealtimeStatelessMessage)
        .filter(
          (message): message is Extract<RealtimeStatelessMessage, { type: typeof type }> => message?.type === type,
        ),
    send: (message) => provider.sendStateless(JSON.stringify(message)),
  };
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("kondisi tidak terpenuhi");
    await sleep(20);
  }
}
