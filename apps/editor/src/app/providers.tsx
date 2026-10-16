import type { Locale } from "@platform/i18n";
import { createApiClient, createPlatformApi, type PlatformApi } from "@platform/sdk";
import { PlatformApiProvider } from "@platform/sdk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useRef, useState } from "react";
import { I18nProvider } from "./i18n";

// Providers editor (ARCHITECTURE §5.2): TanStack Query + @platform/sdk (baseUrl `/api`, same-origin lewat web) + bahasa.
export function createEditorApi(locale: () => Locale): PlatformApi {
  return createPlatformApi(createApiClient({ baseUrl: "/api", locale }));
}

export function AppProviders({ locale, children }: { locale: Locale; children: ReactNode }) {
  // Bahasa aktif dibaca klien api per request (Accept-Language → pesan error api ikut bahasa UI).
  const localeRef = useRef(locale);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // 4xx tidak akan berubah dengan diulang; jaringan/5xx diulang sekali.
          queries: { retry: (count, error) => count < 1 && !isClientError(error), refetchOnWindowFocus: false },
        },
      }),
  );
  const [api] = useState(() => createEditorApi(() => localeRef.current));
  return (
    <QueryClientProvider client={queryClient}>
      <PlatformApiProvider api={api}>
        <I18nProvider
          initial={locale}
          onChange={(next) => {
            localeRef.current = next;
          }}
        >
          {children}
        </I18nProvider>
      </PlatformApiProvider>
    </QueryClientProvider>
  );
}

function isClientError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}
