import type { ReactNode } from "react";

// Route group (dashboard) — ARCHITECTURE §5.1; render dinamis & bahasa diatur root layout `(app)`.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
