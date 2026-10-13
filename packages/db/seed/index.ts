import { envField, parseEnv } from "@platform/shared/env";
import { z } from "zod";
import { createDb } from "../src/client";
import { seedDevData } from "./dev-data";

// `pnpm db:seed` (root, memuat .env). Data dev hanya untuk lingkungan lokal; plan & library seed menyusul.
const env = parseEnv(
  "db:seed",
  { DATABASE_URL: envField.url(), APP_ENV: z.enum(["local", "staging", "production"]) },
  process.env,
);
if (env.APP_ENV !== "local") {
  console.error(`db:seed data dev ditolak: APP_ENV=${env.APP_ENV} (hanya \`local\`).`);
  process.exit(1);
}

const { db, close } = createDb({ connectionString: env.DATABASE_URL, maxConnections: 2 });
try {
  const summary = await seedDevData(db);
  console.log(`Seed selesai — user: ${summary.users.join(", ")}; situs: ${summary.sites.join(", ")}`);
} finally {
  await close();
}
