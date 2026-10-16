import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { loadWebEnv, platformRewrites } from "./src/config/routing";

// Next.js App Router (ARCHITECTURE §5.1). Host routing, gate sesi, locale & header keamanan di `src/proxy.ts`.
const routing = loadWebEnv();

const config: NextConfig = {
  reactStrictMode: true,
  // E2E memakai folder build sendiri: Next 16 mengunci distDir per `next dev`, jadi e2e (port 3110) bisa berjalan
  // berdampingan dengan `pnpm dev` owner (port 3000) tanpa saling menolak.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Dua root layout (marketing statis, app dinamis) → 404 global lewat `app/global-not-found.tsx`.
  experimental: { globalNotFound: true },
  poweredByHeader: false,
  // Paket workspace diekspor sebagai source TS (ARCHITECTURE §4) → ditranspile Next.
  transpilePackages: ["@platform/shared", "@platform/i18n", "@platform/ui"],
  async rewrites() {
    return platformRewrites(routing);
  },
};

// next-intl tanpa routing bahasa di URL; konfigurasi per request di `src/i18n/request.ts`.
export default createNextIntlPlugin("./src/i18n/request.ts")(config);
