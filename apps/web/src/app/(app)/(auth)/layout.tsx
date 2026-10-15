import type { ReactNode } from "react";

// Route group (auth) — ARCHITECTURE §5.1; render dinamis & bahasa diatur root layout `(app)`.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
