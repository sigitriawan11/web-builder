import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useStore } from "zustand";
import { uiPreferencesStore } from "../../store/ui-preferences";

// ED-008: section inspector yang bisa diciutkan; status disimpan di preferensi user.
export function InspectorSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const collapsed = useStore(uiPreferencesStore, (state) => state.collapsedSections.includes(id));
  const toggle = () => {
    const { collapsedSections, update } = uiPreferencesStore.getState();
    update({
      collapsedSections: collapsed ? collapsedSections.filter((section) => section !== id) : [...collapsedSections, id],
    });
  };
  return (
    <section className="border-b" data-testid={`inspector-section-${id}`}>
      <button
        type="button"
        className="flex w-full items-center gap-1 px-3 py-2 text-xs font-semibold"
        aria-expanded={!collapsed}
        onClick={toggle}
      >
        {collapsed ? <ChevronRightIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
        {title}
      </button>
      {collapsed ? null : <div className="flex flex-col gap-2 px-3 pb-3">{children}</div>}
    </section>
  );
}

/** Baris label + nilai; "Mixed" ditampilkan italic (ED-008). */
export function InspectorRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0 truncate">{children}</div>
    </div>
  );
}
