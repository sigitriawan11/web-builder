import { isApiError } from "@platform/sdk";
import { usePlatformApi, useSaveLibraryDraft } from "@platform/sdk/react";
import type { LibraryComponentSummary, LibraryFeature, SaveLibraryDraftBody } from "@platform/shared/contracts";
import { Badge, Button, Checkbox, Input, Label, NativeSelect } from "@platform/ui";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useId, useState } from "react";
import { useT } from "../../app/i18n";

const FEATURES: LibraryFeature[] = ["dynamic", "auth", "commerce"];
const STATUS_VARIANT = {
  draft: "secondary",
  in_review: "outline",
  published: "default",
  deprecated: "outline",
  archived: "outline",
} as const;

// CMP-013: tab Metadata — baca saja utk staf tanpa izin edit; form utk designer/library_admin/super_admin. Definisi
// node diedit lewat canvas/realtime; tab ini hanya metadata (kategori, tag, keyword, deskripsi, aiHints, fitur).
export function MetadataTab({
  componentId,
  component,
  locale,
  canEdit,
}: {
  componentId: string;
  component: LibraryComponentSummary;
  locale: "id" | "en";
  canEdit: boolean;
}) {
  const t = useT();
  if (!canEdit) {
    return (
      <dl className="flex flex-col gap-3 text-sm">
        <ReadField label={t("admin.panel.metadata.name")}>{component.name}</ReadField>
        <ReadField label={t("admin.panel.metadata.displayName")}>{component.displayName[locale]}</ReadField>
        <ReadField label={t("admin.panel.metadata.kind")}>{component.kind}</ReadField>
        <ReadField label={t("admin.panel.metadata.publicId")}>
          <code className="text-xs">{component.publicId}</code>
        </ReadField>
        <ReadField label={t("admin.panel.metadata.status")}>
          <Badge variant={STATUS_VARIANT[component.status]}>{t(`admin.panel.status.${component.status}`)}</Badge>
        </ReadField>
        <ReadField label={t("admin.panel.metadata.description")}>{component.description[locale]}</ReadField>
      </dl>
    );
  }
  return <MetadataForm componentId={componentId} component={component} locale={locale} />;
}

function ReadField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const splitCsv = (value: string): string[] =>
  value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

// Tag/industri → lowercase-kebab (CMP-013): "Split Layout" → "split-layout". Server menolak format lain (422).
const toKebabList = (value: string): string[] =>
  splitCsv(value)
    .map((part) =>
      part
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .filter(Boolean);

function MetadataForm({
  componentId,
  component,
  locale,
}: {
  componentId: string;
  component: LibraryComponentSummary;
  locale: "id" | "en";
}) {
  const t = useT();
  const api = usePlatformApi();
  const categories = useQuery({ queryKey: ["library", "categories"], queryFn: () => api.library.categories() });
  const save = useSaveLibraryDraft();

  const [displayNameId, setDisplayNameId] = useState(component.displayName.id);
  const [displayNameEn, setDisplayNameEn] = useState(component.displayName.en);
  const [descriptionId, setDescriptionId] = useState(component.description.id);
  const [descriptionEn, setDescriptionEn] = useState(component.description.en);
  const [categoryId, setCategoryId] = useState(component.categoryId);
  const [tags, setTags] = useState(component.tags.join(", "));
  const [keywordsId, setKeywordsId] = useState((component.keywords?.id ?? []).join(", "));
  const [keywordsEn, setKeywordsEn] = useState((component.keywords?.en ?? []).join(", "));
  const [industries, setIndustries] = useState(component.industries.join(", "));
  const [aiHints, setAiHints] = useState(component.aiHints ?? "");
  const [features, setFeatures] = useState<LibraryFeature[]>(component.requiresFeatures);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const body: SaveLibraryDraftBody = {
      displayName: { id: displayNameId.trim(), en: displayNameEn.trim() },
      description: { id: descriptionId.trim(), en: descriptionEn.trim() },
      categoryId,
      tags: toKebabList(tags),
      keywords: { id: splitCsv(keywordsId), en: splitCsv(keywordsEn) },
      industries: toKebabList(industries),
      aiHints: aiHints.trim(),
      requiresFeatures: features,
    };
    save.mutate(
      { componentId, body },
      {
        onError: (caught) =>
          setError(
            t("admin.panel.edit.failed", {
              error: isApiError(caught) ? caught.code : caught instanceof Error ? caught.message : String(caught),
            }),
          ),
      },
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <TextField label={t("admin.panel.edit.displayNameId")} value={displayNameId} onChange={setDisplayNameId} />
      <TextField label={t("admin.panel.edit.displayNameEn")} value={displayNameEn} onChange={setDisplayNameEn} />
      <div className="flex flex-col gap-1">
        <Label htmlFor="md-cat">{t("admin.panel.edit.category")}</Label>
        <NativeSelect
          id="md-cat"
          value={categoryId}
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
      <TextAreaField label={t("admin.panel.edit.descriptionId")} value={descriptionId} onChange={setDescriptionId} />
      <TextAreaField label={t("admin.panel.edit.descriptionEn")} value={descriptionEn} onChange={setDescriptionEn} />
      <TextField label={t("admin.panel.edit.tags")} value={tags} onChange={setTags} />
      <TextField label={t("admin.panel.edit.keywordsId")} value={keywordsId} onChange={setKeywordsId} />
      <TextField label={t("admin.panel.edit.keywordsEn")} value={keywordsEn} onChange={setKeywordsEn} />
      <TextField label={t("admin.panel.edit.industries")} value={industries} onChange={setIndustries} />
      <TextAreaField label={t("admin.panel.edit.aiHints")} value={aiHints} onChange={setAiHints} maxLength={500} />
      <fieldset className="flex flex-col gap-1">
        <legend className="text-xs font-medium text-muted-foreground">{t("admin.panel.edit.requiresFeatures")}</legend>
        <div className="flex gap-3">
          {FEATURES.map((feature) => (
            <div key={feature} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                id={`md-feat-${feature}`}
                checked={features.includes(feature)}
                onCheckedChange={(checked) =>
                  setFeatures((prev) => (checked ? [...prev, feature] : prev.filter((f) => f !== feature)))
                }
              />
              <Label htmlFor={`md-feat-${feature}`}>{feature}</Label>
            </div>
          ))}
        </div>
      </fieldset>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {save.isSuccess && !save.isPending ? (
        <p className="text-sm text-muted-foreground">{t("admin.panel.edit.saved")}</p>
      ) : null}
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? t("admin.panel.edit.saving") : t("admin.panel.edit.save")}
      </Button>
    </form>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        className="min-h-16 rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
