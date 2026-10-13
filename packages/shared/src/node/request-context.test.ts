import { setTimeout as sleep } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { createLogger } from "./logger";
import { contextLogFields, getContext, runWithContext, updateContext } from "./request-context";

describe("request context (ARCHITECTURE §13)", () => {
  it("ikut melewati await, timer, dan callback", async () => {
    await runWithContext({ requestId: "r1" }, async () => {
      await sleep(5);
      expect(getContext()?.requestId).toBe("r1");
      await new Promise<void>((resolve) =>
        setTimeout(() => {
          expect(getContext()?.requestId).toBe("r1");
          resolve();
        }, 1),
      );
      queueMicrotask(() => expect(getContext()?.requestId).toBe("r1"));
    });
  });

  it("request paralel tidak saling bocor", async () => {
    const seen = await Promise.all(
      ["a", "b", "c"].map((requestId, index) =>
        runWithContext({ requestId }, async () => {
          await sleep(10 - index * 3);
          updateContext({ userId: `user-${requestId}` });
          await sleep(index * 3);
          return getContext();
        }),
      ),
    );
    expect(seen).toEqual([
      { requestId: "a", userId: "user-a" },
      { requestId: "b", userId: "user-b" },
      { requestId: "c", userId: "user-c" },
    ]);
  });

  it("updateContext terlihat di await berikutnya dalam request yang sama, bukan di konteks luar", async () => {
    await runWithContext({ requestId: "outer" }, async () => {
      await runWithContext({ requestId: "inner" }, async () => {
        updateContext({ workspaceId: "w1", siteId: "s1" });
        await sleep(1);
        expect(getContext()).toEqual({ requestId: "inner", workspaceId: "w1", siteId: "s1" });
      });
      expect(getContext()).toEqual({ requestId: "outer" });
    });
  });

  it("di luar konteks: getContext undefined, field log kosong, updateContext error", () => {
    expect(getContext()).toBeUndefined();
    expect(contextLogFields()).toEqual({});
    expect(() => updateContext({ userId: "u" })).toThrow(/di luar runWithContext/);
  });

  it("konteks tidak valid ditolak (requestId wajib)", () => {
    expect(() => runWithContext({ requestId: "" }, () => 1)).toThrow();
  });

  it("logger dengan mixin contextLogFields membawa requestId & tenant di setiap baris", async () => {
    const lines: Record<string, unknown>[] = [];
    const logger = createLogger({
      service: "worker",
      env: "test",
      mixin: contextLogFields,
      destination: { write: (line: string) => void lines.push(JSON.parse(line)) },
    });
    await runWithContext({ requestId: "req-9", jobId: "job-1" }, async () => {
      updateContext({ siteId: "site-1" });
      await sleep(1);
      logger.info("publish mulai");
    });
    logger.info("tanpa konteks");
    expect(lines[0]).toMatchObject({ service: "worker", requestId: "req-9", jobId: "job-1", siteId: "site-1" });
    expect(lines[1]).not.toHaveProperty("requestId");
  });
});
