import { cn, Input } from "@platform/ui";
import { icons } from "lucide-react";
import { createElement, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import { useT } from "../../app/i18n";
import { brandIconsStore, searchBrandIcons } from "../../canvas/render-root/brand-icons";
import { kebabToPascal, searchIcons } from "../../canvas/render-root/lucide-icon";

type IconSet = "lucide" | "brand";

// Browser ikon (search + grid). Dipakai Icon tool popover (ED-046) & tab Assets → Icons (ED-163). Dua set: Lucide
// (bundel editor) & logo merek Simple Icons (lazy, ~3.4rb). Presentasi murni: `onPick(name, set)` — pemanggil yang
// menyisipkan node & memutuskan aksi lanjutan.
export function IconBrowser({ onPick }: { onPick: (name: string, set: IconSet) => void }) {
  const t = useT();
  const [set, setSet] = useState<IconSet>("lucide");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1" role="tablist" aria-label={t("icons.results")}>
        <SetTab active={set === "lucide"} onClick={() => setSet("lucide")} label={t("icons.lucide")} testId="lucide" />
        <SetTab active={set === "brand"} onClick={() => setSet("brand")} label={t("icons.brand")} testId="brand" />
      </div>
      {set === "lucide" ? (
        <LucideGrid onPick={(name) => onPick(name, "lucide")} />
      ) : (
        <BrandGrid onPick={(name) => onPick(name, "brand")} />
      )}
    </div>
  );
}

function SetTab({
  active,
  onClick,
  label,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={`icon-set-${testId}`}
      className={cn(
        "flex-1 rounded px-2 py-1 text-xs font-medium",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function LucideGrid({ onPick }: { onPick: (name: string) => void }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const results = useMemo(() => searchIcons(deferred, 60), [deferred]);
  return (
    <div className="flex flex-col gap-2">
      <Input
        type="search"
        placeholder={t("icons.search")}
        aria-label={t("icons.search")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-8"
        data-testid="icon-search"
      />
      <div className="grid max-h-64 grid-cols-6 gap-1 overflow-y-auto" role="listbox" aria-label={t("icons.results")}>
        {results.map((name) => {
          const Icon = (icons as Record<string, React.ComponentType<{ className?: string }>>)[kebabToPascal(name)];
          return (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={false}
              aria-label={name}
              title={name}
              data-testid={`icon-option-${name}`}
              className={cn("flex size-8 items-center justify-center rounded hover:bg-accent")}
              onClick={() => onPick(name)}
            >
              {Icon ? createElement(Icon, { className: "size-4" }) : null}
            </button>
          );
        })}
        {results.length === 0 ? (
          <p className="col-span-6 p-2 text-xs text-muted-foreground">{t("icons.empty")}</p>
        ) : null}
      </div>
    </div>
  );
}

function BrandGrid({ onPick }: { onPick: (name: string) => void }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const loaded = useStore(brandIconsStore, (state) => state.loaded);
  // Muat data Simple Icons saat tab brand dibuka (lazy; idempoten).
  useEffect(() => brandIconsStore.getState().load(), []);
  const results = useMemo(() => {
    // `loaded` di-depend agar grid re-compute setelah data termuat (store di luar React state).
    void loaded;
    return searchBrandIcons(deferred, 120);
  }, [deferred, loaded]);
  return (
    <div className="flex flex-col gap-2">
      <Input
        type="search"
        placeholder={t("icons.brandSearch")}
        aria-label={t("icons.brandSearch")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-8"
        data-testid="brand-search"
      />
      <div className="grid max-h-64 grid-cols-6 gap-1 overflow-y-auto" role="listbox" aria-label={t("icons.brand")}>
        {results.map((icon) => (
          <button
            key={icon.slug}
            type="button"
            role="option"
            aria-selected={false}
            aria-label={icon.title}
            title={icon.title}
            data-testid={`brand-option-${icon.slug}`}
            className={cn("flex size-8 items-center justify-center rounded hover:bg-accent")}
            onClick={() => onPick(icon.slug)}
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" role="presentation">
              <path d={icon.path} />
            </svg>
          </button>
        ))}
        {results.length === 0 ? (
          <p className="col-span-6 p-2 text-xs text-muted-foreground">
            {loaded ? t("icons.empty") : t("icons.brandLoading")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
