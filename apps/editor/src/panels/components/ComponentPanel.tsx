import { useLibraryComponentUsage } from "@platform/sdk/react";
import type { LibraryComponentSummary, LibraryStatus } from "@platform/shared/contracts";
import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "@platform/ui";
import type { ReactNode } from "react";
import { useT } from "../../app/i18n";

// CMP-012: panel kanan Mode Admin. Tab yang punya data sekarang terisi (Metadata baca, Versions, Usage); tab editing
// (Props/Variants/Access/QA) placeholder — masing-masing dibangun di task tersendiri (T3.4.4/5/7/9, QA).
const TABS = ["metadata", "props", "variants", "access", "qa", "versions", "usage"] as const;
type TabKey = (typeof TABS)[number];
// Tab yang belum punya editor sendiri → placeholder "coming soon".
const PLACEHOLDER_TABS = new Set<TabKey>(["props", "variants", "access", "qa"]);

const STATUS_VARIANT: Record<LibraryStatus, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  in_review: "outline",
  published: "default",
  deprecated: "outline",
  archived: "outline",
};

export function ComponentPanel({
  componentId,
  component,
  locale,
}: {
  // UUID internal (sama dengan sesi editor & endpoint usage), bukan public_id.
  componentId: string;
  component: LibraryComponentSummary;
  locale: "id" | "en";
}) {
  const t = useT();
  return (
    <aside
      className="flex w-80 shrink-0 flex-col border-l bg-background"
      data-testid="component-panel"
      aria-label={t("admin.panel.title")}
    >
      <Tabs defaultValue="metadata" className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {t(`admin.panel.tabs.${tab}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="metadata">
          <dl className="flex flex-col gap-3 text-sm">
            <Field label={t("admin.panel.metadata.name")}>{component.name}</Field>
            <Field label={t("admin.panel.metadata.displayName")}>{component.displayName[locale]}</Field>
            <Field label={t("admin.panel.metadata.kind")}>{component.kind}</Field>
            <Field label={t("admin.panel.metadata.publicId")}>
              <code className="text-xs">{component.publicId}</code>
            </Field>
            <Field label={t("admin.panel.metadata.status")}>
              <Badge variant={STATUS_VARIANT[component.status]}>{t(`admin.panel.status.${component.status}`)}</Badge>
            </Field>
            <Field label={t("admin.panel.metadata.description")}>{component.description[locale]}</Field>
          </dl>
        </TabsContent>

        <TabsContent value="versions">
          <dl className="flex flex-col gap-3 text-sm">
            <Field label={t("admin.panel.metadata.status")}>
              <Badge variant={STATUS_VARIANT[component.status]}>{t(`admin.panel.status.${component.status}`)}</Badge>
            </Field>
            <Field label={t("admin.panel.versions.latest")}>
              {component.latestVersion ?? (
                <span className="text-muted-foreground">{t("admin.panel.versions.none")}</span>
              )}
            </Field>
            {component.hasDraft ? (
              <p className="text-xs text-muted-foreground">{t("admin.panel.versions.hasDraft")}</p>
            ) : null}
          </dl>
        </TabsContent>

        <TabsContent value="usage">
          <UsageTable componentId={componentId} />
        </TabsContent>

        {[...PLACEHOLDER_TABS].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <p className="text-sm text-muted-foreground">{t("admin.panel.comingSoon")}</p>
          </TabsContent>
        ))}
      </Tabs>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

// CMP-012 AC: agregat per versi/docState. Agregasi dilakukan server (`usageByComponent`).
function UsageTable({ componentId }: { componentId: string }) {
  const t = useT();
  const usage = useLibraryComponentUsage(componentId);
  if (usage.isPending) return <p className="text-sm text-muted-foreground">{t("admin.panel.usage.loading")}</p>;
  if (usage.isError) return <p className="text-sm text-destructive">{t("admin.panel.usage.failed")}</p>;
  if (usage.data.length === 0) return <p className="text-sm text-muted-foreground">{t("admin.panel.usage.empty")}</p>;
  return (
    <table className="w-full text-left text-sm" data-testid="usage-table">
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th className="py-1 pr-2 font-medium">{t("admin.panel.usage.version")}</th>
          <th className="py-1 pr-2 font-medium">{t("admin.panel.usage.docState")}</th>
          <th className="py-1 pr-2 text-right font-medium">{t("admin.panel.usage.sites")}</th>
          <th className="py-1 text-right font-medium">{t("admin.panel.usage.instances")}</th>
        </tr>
      </thead>
      <tbody>
        {usage.data.map((row) => (
          <tr key={`${row.version}:${row.docState}`} className="border-t">
            <td className="py-1 pr-2">{row.version}</td>
            <td className="py-1 pr-2">{t(`admin.panel.status.${row.docState}`)}</td>
            <td className="py-1 pr-2 text-right tabular-nums">{row.siteCount}</td>
            <td className="py-1 text-right tabular-nums">{row.instanceCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
