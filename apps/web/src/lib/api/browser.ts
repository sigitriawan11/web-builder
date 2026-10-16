import { createApiClient, createPlatformApi, isApiError, type PlatformApi } from "@platform/sdk";

// Panggilan api dari Client Component (ARCHITECTURE §5.1): `@platform/sdk` dengan `baseUrl = /api` (same-origin, cookie
// sesi ikut). Endpoint Better Auth `/auth/*` memakai klien terpisah (`lib/auth/client.ts`) karena bentuk error-nya bukan
// envelope api.
let instance: PlatformApi | null = null;

export function browserApi(): PlatformApi {
  instance ??= createPlatformApi(
    // Bahasa halaman (`<html lang>`) → Accept-Language: pesan error api dilokalkan sama dengan UI.
    createApiClient({ baseUrl: "/api", locale: () => document.documentElement.lang || undefined }),
  );
  return instance;
}

export interface Failure {
  code: string;
  status: number;
  retryAfterSeconds?: number | null | undefined;
  details?: Readonly<Record<string, unknown>> | undefined;
}

/** Error apa pun dari panggilan sdk → bentuk yang dipahami `useFailureMessage`. */
export function asFailure(error: unknown): Failure {
  if (isApiError(error)) return error;
  return { code: "UNEXPECTED", status: 0 };
}
