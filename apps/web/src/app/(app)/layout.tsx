import { isThemePreference, THEME_COOKIE, themeClassName } from "@platform/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import "../globals.css";

// Root layout host `app.` (auth, dashboard, admin — ARCHITECTURE §5.1): DINAMIS — bahasa per request (cookie
// `NEXT_LOCALE` → Accept-Language → `id`, dihitung proxy) dan CSP nonce per request (PUB-211) butuh render per request.
export const metadata: Metadata = { title: "Platform" };

// Namespace yang dikirim ke komponen klien (email & editor tidak dipakai di web).
const CLIENT_NAMESPACES = ["common", "auth", "dashboard", "billing", "admin", "errors"] as const;

export default async function AppRootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const clientMessages = Object.fromEntries(CLIENT_NAMESPACES.map((namespace) => [namespace, messages[namespace]]));
  // Tema chrome (ED-012) dari cookie → kelas <html> sejak render server (tanpa kedip, tanpa script inline).
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  return (
    <html lang={locale} className={themeClassName(isThemePreference(theme) ? theme : "system")}>
      <body>
        <NextIntlClientProvider messages={clientMessages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
