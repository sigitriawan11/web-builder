import { getContext } from "@platform/shared/node";
import { type Job, UnrecoverableError } from "bullmq";
import { describe, expect, it, vi } from "vitest";
import { createWorkerLogger } from "../worker-process";
import { jobRunner } from "./run-job";

const logger = createWorkerLogger({ APP_ENV: "local", LOG_LEVEL: "fatal" }, { write: () => {} });
// Payload thumbnails = discriminated union (CMP-014); varian component published.
const ids = { target: "component" as const, componentVersionId: "01a135f2-b67d-71b3-9fbc-775f6ef635e9" };
const fakeJob = (data: unknown, attemptsMade = 0) => ({ id: "42", data, attemptsMade }) as unknown as Job;

describe("jobRunner", () => {
  it("payload valid → handler menerima payload + konteks log requestId/jobId", async () => {
    let seen: unknown;
    const handler = vi.fn(async (_payload: unknown, context: { attempt: number }) => {
      seen = { context: getContext(), attempt: context.attempt };
    });
    await jobRunner("thumbnails", handler, { logger })(fakeJob({ requestId: "req-12345678", ...ids }, 1));
    expect(handler).toHaveBeenCalledWith({ requestId: "req-12345678", ...ids }, expect.anything());
    expect(seen).toEqual({ context: { requestId: "req-12345678", jobId: "42" }, attempt: 2 });
  });

  it("payload tidak sesuai kontrak → UnrecoverableError (tanpa retry), handler tidak dipanggil", async () => {
    const handler = vi.fn(async () => {});
    await expect(jobRunner("thumbnails", handler, { logger })(fakeJob({ requestId: "r" }))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("melewati timeout queue → gagal (di-retry BullMQ) dan signal dibatalkan", async () => {
    let signal: AbortSignal | undefined;
    const handler = async (_payload: unknown, context: { signal: AbortSignal }) => {
      signal = context.signal;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    };
    await expect(
      jobRunner("thumbnails", handler, { logger, timeoutMs: 20 })(fakeJob({ requestId: "req-12345678", ...ids })),
    ).rejects.toThrow(/melewati batas 20 ms/);
    expect(signal?.aborted).toBe(true);
  });

  it("error handler diteruskan apa adanya (BullMQ me-retry sesuai attempts)", async () => {
    const handler = async () => {
      throw new Error("smtp down");
    };
    await expect(
      jobRunner("thumbnails", handler, { logger })(fakeJob({ requestId: "req-12345678", ...ids })),
    ).rejects.toThrow("smtp down");
  });
});
