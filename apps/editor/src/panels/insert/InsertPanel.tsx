import { MinusIcon, SquareIcon } from "lucide-react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { ComponentsPanel } from "./ComponentsPanel";
import { insertButton, insertDivider } from "./insert-elements";

// ED-050 / §20 (minimal): bagian "Basic" Insert panel — Button & Divider. Section templates & component library
// menyusul (Epic 2.12/M3).
export function InsertPanel({ runtime, readOnly }: { runtime: CanvasRuntime; readOnly: boolean }) {
  const t = useT();
  const items = [
    {
      key: "button",
      label: t("insert.button"),
      icon: <SquareIcon />,
      onClick: () => insertButton(runtime, t("insert.buttonLabel")),
    },
    { key: "divider", label: t("insert.divider"), icon: <MinusIcon />, onClick: () => insertDivider(runtime) },
  ];
  return (
    <div className="p-2" data-testid="insert-panel">
      <h2 className="mb-1 px-1 text-xs font-semibold">{t("insert.basic")}</h2>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            disabled={readOnly}
            data-testid={`insert-${item.key}`}
            className="flex flex-col items-center gap-1 rounded border p-3 text-xs hover:bg-accent disabled:opacity-50"
            onClick={item.onClick}
          >
            <span className="[&_svg]:size-5">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-3 border-t pt-1">
        <ComponentsPanel runtime={runtime} readOnly={readOnly} />
      </div>
    </div>
  );
}
