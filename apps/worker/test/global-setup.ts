import { prepareTemplate } from "@platform/db/testing";

// Integration test worker: template DB sendiri (turbo menjalankan integration test paket lain paralel).
export default async function setup(): Promise<void> {
  process.env.PLATFORM_TEST_TEMPLATE = "platform_test_worker";
  await prepareTemplate();
}
