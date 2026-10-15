import type { Metadata } from "next";
import type { ReactNode } from "react";

// Root layout semua route group (ARCHITECTURE §5.1). Bahasa dari preferensi user/cookie menyusul (next-intl, T1.14.2).
export const metadata: Metadata = { title: "Platform" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
