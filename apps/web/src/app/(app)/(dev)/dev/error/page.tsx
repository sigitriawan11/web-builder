import { notFound } from "next/navigation";
import { loadWebEnv } from "../../../../../config/routing";

// Seam e2e telemetri (T1.16.3): error render server sungguhan → `onRequestError` → Sentry. Tidak ada di production.
export const dynamic = "force-dynamic";

export default function DevErrorPage(): never {
  if (loadWebEnv().APP_ENV === "production") notFound();
  throw new Error("e2e: kesalahan server web disengaja");
}
