import { prepareTemplate } from "@platform/db/testing";

// Integration test api: template DB sendiri (bukan milik paket db) karena turbo menjalankan keduanya paralel.
export default async function setup(): Promise<void> {
  process.env.PLATFORM_TEST_TEMPLATE = "platform_test_api";
  await prepareTemplate();
}
