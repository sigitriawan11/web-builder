import { REDACTED } from "@platform/shared/contracts";
import type { Job } from "bullmq";
import { describe, expect, it } from "vitest";
import { deadLetterEntry, isFinalFailure } from "./dead-letter";

const job = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "42",
    name: "auth.password_reset",
    data: {},
    attemptsMade: 5,
    finishedOn: 1_790_000_000_000,
    ...overrides,
  }) as unknown as Job;

describe("deadLetterEntry", () => {
  it("menyalin metadata job, menyensor URL bertoken, memakai requestId asal", () => {
    const data = { requestId: "req-1", template: "auth.password_reset", userId: "u1", resetUrl: "https://x/?token=t" };
    const entry = deadLetterEntry("email", job({ data }), new Error("gagal"));
    expect(entry).toMatchObject({
      requestId: "req-1",
      sourceQueue: "email",
      jobId: "42",
      jobName: "auth.password_reset",
      attempts: 5,
      payload: { ...data, resetUrl: REDACTED },
      error: { message: "gagal" },
      failedAt: new Date(1_790_000_000_000).toISOString(),
    });
  });

  it("payload tanpa requestId (kontrak rusak) → requestId sintetis", () => {
    expect(deadLetterEntry("publish", job({ data: "bukan objek" }), new Error("x")).requestId).toBe("dlq:publish:42");
  });

  it("final hanya bila BullMQ mengisi finishedOn (bukan saat dijadwalkan retry)", () => {
    expect(isFinalFailure(job())).toBe(true);
    expect(isFinalFailure(job({ finishedOn: undefined }))).toBe(false);
  });
});
