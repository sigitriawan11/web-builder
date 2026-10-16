import "server-only";
import { cookies, headers } from "next/headers";
import { loadWebEnv } from "../../config/routing";

// Panggilan api dari Server Component (ARCHITECTURE §5.1): langsung ke `API_INTERNAL_URL` dengan meneruskan cookie
// sesi & `x-request-id`. Next.js tidak mengakses database; aturan bisnis & isolasi tenant tetap di apps/api.
export async function apiServerGet<T>(path: string): Promise<{ status: number; body: T | null }> {
  const env = loadWebEnv();
  const requestHeaders = await headers();
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(`${env.API_INTERNAL_URL.replace(/\/$/, "")}${path}`, {
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      "x-request-id": requestHeaders.get("x-request-id") ?? crypto.randomUUID(),
      "accept-language": requestHeaders.get("x-locale") ?? "id",
    },
    cache: "no-store",
  });
  const body = response.headers.get("content-type")?.includes("application/json")
    ? ((await response.json()) as T)
    : null;
  return { status: response.status, body };
}
