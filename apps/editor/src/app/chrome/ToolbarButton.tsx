import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@platform/ui";
import type { ComponentProps, ReactNode } from "react";
import { ariaShortcut, formatShortcut, type Shortcut } from "./shortcut";

interface ToolbarButtonProps extends Omit<ComponentProps<typeof Button>, "children"> {
  label: string;
  shortcut?: Shortcut | undefined;
  // Tombol toggle (tool aktif, breakpoint aktif): state pressed + `aria-pressed` (AC ED-006).
  pressed?: boolean | undefined;
  icon: ReactNode;
}

/**
 * ED-006: tombol ikon toolbar — `aria-label` = nama, tooltip = nama + shortcut, `aria-keyshortcuts` untuk pembaca
 * layar. Tombol nonaktif dibungkus span agar tooltip tetap muncul (elemen disabled tidak memicu hover).
 */
// React 19: `ref` adalah prop biasa (dipakai `asChild` trigger menu) — diteruskan lewat `...props`.
export function ToolbarButton({ label, shortcut, pressed, icon, disabled, className, ...props }: ToolbarButtonProps) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      {...(shortcut ? { "aria-keyshortcuts": ariaShortcut(shortcut) } : {})}
      {...(pressed !== undefined ? { "aria-pressed": pressed } : {})}
      data-tooltip={shortcut ? `${label} ${formatShortcut(shortcut)}` : label}
      disabled={disabled}
      className={pressed ? `bg-accent text-accent-foreground ${className ?? ""}` : className}
      {...props}
    >
      {icon}
    </Button>
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>{disabled ? <span className="inline-flex">{button}</span> : button}</TooltipTrigger>
      <TooltipContent>
        <span>{label}</span>
        {shortcut ? <kbd className="font-sans opacity-70">{formatShortcut(shortcut)}</kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}
