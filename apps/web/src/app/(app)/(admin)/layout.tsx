import type { ReactNode } from "react";
import { getStaffCapabilities } from "../../../lib/admin/current";

// Route group (admin) — ARCHITECTURE §5.1. GERBANG role staf (ACC-208/CMP-010): `getStaffCapabilities()` memanggil
// endpoint capabilities yang 404 untuk non-staf → `notFound()` (permukaan admin tak bocor, mirror kontrak API).
// 2FA wajib staf (ACC-200) ditegakkan di API (T3.8.3). Chrome dashboard tidak diwarisi grup ini → bungkus sederhana.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await getStaffCapabilities();
  return <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>;
}
