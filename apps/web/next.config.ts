import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { loadWebEnv, platformRewrites } from "./src/config/routing";

// Next.js App Router (ARCHITECTURE §5.1). Host routing, gate sesi, locale & header keamanan di `src/proxy.ts`.
const routing = loadWebEnv();

const config: NextConfig = {
  reactStrictMode: true,
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
