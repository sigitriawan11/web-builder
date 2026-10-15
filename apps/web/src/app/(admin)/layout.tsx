import { connection } from "next/server";
import type { ReactNode } from "react";

// Route group (admin) — ARCHITECTURE §5.1. Render dinamis wajib: CSP nonce per request (PUB-211) hanya bisa
// dipasang Next saat render di server per request.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await connection();
  return children;
}
