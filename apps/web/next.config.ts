import type { NextConfig } from "next";
import { loadWebEnv, platformRewrites } from "./src/config/routing";

// Next.js App Router (ARCHITECTURE §5.1). Header keamanan menyusul T1.14.3, middleware T1.14.2.
const routing = loadWebEnv();

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Paket workspace diekspor sebagai source TS (ARCHITECTURE §4) → ditranspile Next.
  transpilePackages: ["@platform/shared", "@platform/i18n", "@platform/ui"],
  async rewrites() {
    return platformRewrites(routing);
  },
};

export default config;
