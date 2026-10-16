"use client";

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@platform/ui";
import { FileIcon, LayoutTemplateIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { apiPost } from "../../lib/auth/client";
import { useFailureMessage } from "../auth/use-failure-message";

const OPTIONS = [
  { value: "template", Icon: LayoutTemplateIcon, available: false },
  { value: "blank", Icon: FileIcon, available: true },
  { value: "ai", Icon: SparklesIcon, available: false },
] as const;

// ACC-051 (M1): modal "Buat website" — jalur Kosong aktif; Template (M4) & AI (M6) tampil "Segera". Situs kosong
// dibuat api (dokumen awal 1 page Home, bahasa = bahasa UI pembuat) lalu editor dibuka.
export function CreateSiteDialog({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("dashboard.createSite");
  const failureMessage = useFailureMessage();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(form: FormData) {
    setPending(true);
    setError(null);
    const result = await apiPost<{ data: { id: string } }>(`/v1/workspaces/${workspaceId}/sites`, {
      name: String(form.get("name") ?? "").trim(),
    });
    if (result.ok) {
      window.location.assign(`/editor/${result.data.data.id}`);
      return;
    }
    setPending(false);
    if (result.status === 403) setError(t("forbidden"));
    else if (result.code === "PLAN_LIMIT_REACHED") setError(t("limit"));
    else setError(failureMessage(result));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <PlusIcon />
          {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void create(new FormData(event.currentTarget));
          }}
        >
          <fieldset className="grid gap-2 sm:grid-cols-3">
            <legend className="sr-only">{t("options.label")}</legend>
            {OPTIONS.map(({ value, Icon, available }) => (
              <label
                key={value}
                className={cn(
                  "relative flex flex-col gap-1 rounded-lg border p-3 text-sm",
                  available
                    ? "cursor-pointer has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/30"
                    : "cursor-not-allowed opacity-60",
                )}
              >
                <input
                  type="radio"
                  name="start"
                  value={value}
                  defaultChecked={value === "blank"}
                  disabled={!available}
                  className="sr-only"
                />
                <Icon className="size-5 text-muted-foreground" aria-hidden />
                <span className="font-medium">{t(`options.${value}.title`)}</span>
                <span className="text-xs text-muted-foreground">{t(`options.${value}.description`)}</span>
                {available ? null : (
                  <Badge variant="secondary" className="absolute top-2 right-2">
                    {t("options.soon")}
                  </Badge>
                )}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-site-name">{t("name")}</Label>
            <Input
              id="create-site-name"
              name="name"
              required
              maxLength={80}
              placeholder={t("namePlaceholder")}
              aria-describedby="create-site-name-hint"
            />
            <p id="create-site-name-hint" className="text-xs text-muted-foreground">
              {t("nameHint")}
            </p>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
