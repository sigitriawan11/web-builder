import { loadWebEnv } from "../../config/routing";

// Halaman legal di host marketing (`/legal/*`, isi M4; versi di `LEGAL_VERSIONS` @platform/shared).
export function legalUrls(): { termsUrl: string; privacyUrl: string } {
  const marketing = loadWebEnv().PUBLIC_MARKETING_URL.replace(/\/$/, "");
  return { termsUrl: `${marketing}/legal/terms`, privacyUrl: `${marketing}/legal/privacy` };
}
