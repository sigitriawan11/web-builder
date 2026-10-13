import { prepareTemplate } from "./test-db";

// Vitest globalSetup integration test: migration ke template sekali per run.
export default async function setup(): Promise<void> {
  await prepareTemplate();
}
