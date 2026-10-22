"use client";

import { Button } from "@platform/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { asFailure, browserApi } from "../../lib/api/browser";

// T3.8.2 (CMP-045/CMP-051): aksi deprecate/archive di detail component admin. Hanya staf berkapabilitas publish
// (gated di server). Setelah sukses → `router.refresh()` agar status + daftar versi ter-update.
export function AdminComponentActions({ componentId, status }: { componentId: string; status: string }) {
  const t = useTranslations("admin.libraryDetail");
  const router = useRouter();
  const [pending, setPending] = useState<"deprecate" | "archive" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: "deprecate" | "archive") => {
    setPending(action);
    setError(null);
    try {
      if (action === "deprecate") await browserApi().library.deprecate(componentId);
      else await browserApi().library.archive(componentId);
      router.refresh();
    } catch (caught) {
      setError(asFailure(caught).code);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          data-testid="admin-component-deprecate"
          disabled={pending !== null || status === "deprecated" || status === "archived"}
          onClick={() => run("deprecate")}
        >
          {t("deprecate")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="admin-component-archive"
          disabled={pending !== null || status === "archived"}
          onClick={() => run("archive")}
        >
          {t("archive")}
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-destructive" data-testid="admin-component-action-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
