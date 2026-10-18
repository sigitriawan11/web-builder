import { cn, Input } from "@platform/ui";
import { icons } from "lucide-react";
import { createElement, useDeferredValue, useMemo, useState } from "react";
import { useT } from "../../app/i18n";
import { kebabToPascal, searchIcons } from "../../canvas/render-root/lucide-icon";

// Browser ikon Lucide (search + grid). Dipakai Icon tool popover (ED-046) & tab Assets → Icons (ED-163). Presentasi
// murni: `onPick(name)` — pemanggil yang menyisipkan node & memutuskan aksi lanjutan.
export function IconBrowser({ onPick }: { onPick: (name: string) => void }) {
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
