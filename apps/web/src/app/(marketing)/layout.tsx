import type { Metadata } from "next";
import type { ReactNode } from "react";

// Root layout host apex (marketing, ARCHITECTURE §5.1): STATIS (SSG/ISR) — tidak membaca cookie/header, jadi bahasa
// tetap default `id`. Versi EN marketing (path/host terpisah) diputuskan bersama konten marketing (T1.14.9+).
export const metadata: Metadata = { title: "Platform" };

export default function MarketingRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
