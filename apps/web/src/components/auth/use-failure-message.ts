"use client";

import { useTranslations } from "next-intl";
import { type ApiFailure, NETWORK_ERROR } from "../../lib/auth/client";

/** Pesan umum untuk kegagalan yang tidak ditangani khusus oleh form (rate limit, jaringan, lainnya). */
export function useFailureMessage(): (failure: ApiFailure) => string {
  const t = useTranslations("auth.common");
  return (failure) => {
    if (failure.code === NETWORK_ERROR) return t("network");
    if (failure.status === 429) {
      return failure.retryAfterSeconds === null
        ? t("rateLimitedGeneric")
        : t("rateLimited", { seconds: failure.retryAfterSeconds });
    }
    return t("unexpected");
  };
}
