import { usePlatformApi } from "@platform/sdk/react";
import type { ComponentKind } from "@platform/shared/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NativeSelect,
} from "@platform/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { createComponentFromSelection } from "./create-component";

const KINDS: ComponentKind[] = ["element", "block", "section", "page", "layout"];

// CMP-011: dialog metadata saat menjadikan seleksi sebuah component. Minimal (name/displayName/kind/category);
// metadata lain (tags, keywords, deskripsi) diisi di panel Metadata (T3.4.4).
export function CreateComponentDialog({
  open,
  onOpenChange,
  runtime,
  selectedIds,
  locale,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runtime: CanvasRuntime;
  selectedIds: readonly string[];
  locale: "id" | "en";
  onCreated?: (publicId: string) => void;
}) {
  const t = useT();
  const api = usePlatformApi();
  const categories = useQuery({ queryKey: ["library", "categories"], queryFn: () => api.library.categories() });
  const [name, setName] = useState("");
  const [displayId, setDisplayId] = useState("");
  const [displayEn, setDisplayEn] = useState("");
  const [kind, setKind] = useState<ComponentKind>("element");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resolvedCategory = categoryId || categories.data?.[0]?.id || "";
  const canSubmit = name.trim().length > 0 && selectedIds.length === 1 && resolvedCategory !== "" && !busy;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const { publicId } = await createComponentFromSelection({
        api,
        runtime,
        selectedIds,
        form: {
          name: name.trim(),
          displayName: { id: displayId.trim() || name.trim(), en: displayEn.trim() || name.trim() },
          kind,
          categoryId: resolvedCategory,
        },
      });
      onCreated?.(publicId);
      onOpenChange(false);
    } catch (caught) {
      setError(t("admin.create.failed", { error: caught instanceof Error ? caught.message : String(caught) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("admin.create.cancel")}>
        <DialogHeader>
          <DialogTitle>{t("admin.create.title")}</DialogTitle>
        </DialogHeader>
        {selectedIds.length !== 1 ? (
          <p className="text-sm text-muted-foreground">{t("admin.create.selectOne")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="cc-name">{t("admin.create.name")}</Label>
              <Input id="cc-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor="cc-dn-id">{t("admin.create.displayNameId")}</Label>
                <Input id="cc-dn-id" value={displayId} onChange={(e) => setDisplayId(e.target.value)} />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor="cc-dn-en">{t("admin.create.displayNameEn")}</Label>
                <Input id="cc-dn-en" value={displayEn} onChange={(e) => setDisplayEn(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor="cc-kind">{t("admin.create.kind")}</Label>
                <NativeSelect id="cc-kind" value={kind} onChange={(e) => setKind(e.target.value as ComponentKind)}>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor="cc-cat">{t("admin.create.category")}</Label>
                <NativeSelect
                  id="cc-cat"
                  value={resolvedCategory}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={!categories.data?.length}
                >
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name[locale] || c.name.id}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("admin.create.cancel")}
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {t("admin.create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
