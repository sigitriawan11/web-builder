import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";

// Root layout host `app.` (auth, dashboard, admin — ARCHITECTURE §5.1): DINAMIS — bahasa per request (cookie
// `NEXT_LOCALE` → Accept-Language → `id`, dihitung proxy) dan CSP nonce per request (PUB-211) butuh render per request.
export const metadata: Metadata = { title: "Platform" };

// Namespace yang dikirim ke komponen klien (email & editor tidak dipakai di web).
const CLIENT_NAMESPACES = ["common", "auth", "dashboard", "billing", "admin", "errors"] as const;

export default async function AppRootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const clientMessages = Object.fromEntries(CLIENT_NAMESPACES.map((namespace) => [namespace, messages[namespace]]));
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={clientMessages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
