import type { ReactNode } from "react";

// Route group (admin) — ARCHITECTURE §5.1; render dinamis & bahasa diatur root layout `(app)`.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
