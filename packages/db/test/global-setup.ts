import { prepareTemplate } from "./test-db";

// Vitest globalSetup integration test: migration ke template sekali per run.
export default async function setup(): Promise<void> {
  // Diwarisi worker test; template & DB per file milik paket db saja.
  process.env.PLATFORM_TEST_TEMPLATE = "platform_test_db";
  await prepareTemplate();
}
