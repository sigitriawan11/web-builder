import { describe, expect, it } from "vitest";
import { selectQueues } from "./workers";

const processors = { thumbnails: async () => {}, publish: async () => {} };

describe("selectQueues (WORKER_QUEUES)", () => {
  it("all → semua queue yang punya processor", () => {
    expect(selectQueues("all", processors).sort()).toEqual(["publish", "thumbnails"]);
  });
  it("daftar eksplisit dipakai apa adanya", () => {
    expect(selectQueues(["publish"], processors)).toEqual(["publish"]);
  });
  it("queue tanpa processor → error konfigurasi", () => {
    expect(() => selectQueues(["publish", "email"], processors)).toThrow(/tanpa processor: email/);
  });
});
