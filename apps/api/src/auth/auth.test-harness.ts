import type { TestDb } from "@platform/db/testing";
import { uuidv7 } from "@platform/shared";
import type { Redis } from "ioredis";
import { type AppDeps, createApp } from "../app";
import type { QueueProducer } from "../queues/producer";
import { silentLogger } from "../test-utils";
import { createAuth } from "./auth";

// Perangkat integration test auth: app dengan Better Auth + Postgres & Redis asli, counter rate limit terpisah per
// app, dan producer palsu yang mencatat job.

export const TEST_ORIGIN = "http://app.localhost:3000";
export const STRONG_PASSWORD = "Kue-Lapis-2026!";

export interface RecordedJob {
  queue: string;
  payload: unknown;
}

export function recordingQueues(): QueueProducer & { jobs: RecordedJob[] } {
  const jobs: RecordedJob[] = [];
  return {
    jobs,
    enqueue: async (queue, payload) => {
      jobs.push({ queue, payload });
      return `job-${jobs.length}`;
    },
    close: async () => {},
  };
}

export function authTestApp(
  testDb: TestDb,
  redis: Redis,
  queues: QueueProducer = recordingQueues(),
  extra: Pick<AppDeps, "verifyCaptcha" | "mountRoutes"> = {},
) {
  const auth = createAuth({
    db: testDb.db,
    redis,
    logger: silentLogger(),
    queues,
    config: {
      secret: "test-better-auth-secret-0123456789abcdef",
      publicAuthUrl: `${TEST_ORIGIN}/api/auth`,
      trustedOrigins: [TEST_ORIGIN],
      secureCookies: false,
    },
  });
  return createApp({ logger: silentLogger(), auth, redis, rateLimitPrefix: `rl-test:${uuidv7()}`, ...extra });
}

export const uniqueEmail = () =>
  `user.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@platform.test`;

export const signUpBody = (email: string, extra: Record<string, unknown> = {}) => ({
  name: "Budi Santoso",
  email,
  password: STRONG_PASSWORD,
  acceptTerms: true,
  ...extra,
});

export const sessionCookie = (setCookie: string[] | string | undefined) =>
  ([] as string[])
    .concat(setCookie ?? [])
    .find((cookie) => cookie.startsWith("platform.session_token="))
    ?.split(";")[0];
