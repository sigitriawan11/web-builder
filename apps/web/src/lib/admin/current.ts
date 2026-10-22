import "server-only";
import { isApiError } from "@platform/sdk";
import type { LibraryCapabilities } from "@platform/shared/contracts";
import { notFound } from "next/navigation";
import { cache } from "react";
import { withSession } from "../api/server";

// Role-gating permukaan admin (ACC-208/CMP-010): kapabilitas user dari `GET /v1/admin/library/capabilities`.
// Endpoint mengembalikan 404 untuk non-staf (permukaan admin tak boleh bocor) → mirror ke `notFound()` di web.
// `withSession` sudah menangani 401 (sesi basi → /login). Satu panggilan per render (`cache`).
export const getStaffCapabilities = cache(async (): Promise<LibraryCapabilities> => {
  try {
    return await withSession((api) => api.library.capabilities());
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
});
