import type { ReactNode } from "react";

// Route group (auth) — ARCHITECTURE §5.1: halaman login/registrasi/verifikasi/reset, satu kolom di tengah.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
