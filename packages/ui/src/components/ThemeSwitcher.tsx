"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { ToggleGroup } from "radix-ui";
import { useState } from "react";
import { cn } from "../lib/cn";
import { applyThemePreference, isThemePreference, THEME_PREFERENCES, type ThemePreference } from "../theme";

const ICONS = { system: MonitorIcon, light: SunIcon, dark: MoonIcon } as const;

export interface ThemeSwitcherProps {
  initial: ThemePreference;
  // Label dari i18n pemakai (paket UI tidak memuat string).
  labels: Readonly<Record<ThemePreference, string>>;
  groupLabel: string;
  className?: string;
}

/** Pilihan tema chrome (ED-012): ikuti OS / terang / gelap — Radix ToggleGroup (navigasi panah, aria-pressed). */
export function ThemeSwitcher({ initial, labels, groupLabel, className }: ThemeSwitcherProps) {
  const [preference, setPreference] = useState(initial);
  return (
    <ToggleGroup.Root
      type="single"
      value={preference}
      aria-label={groupLabel}
      onValueChange={(value) => {
        // Klik pada pilihan aktif mengirim "" → abaikan (selalu ada satu pilihan).
        if (!isThemePreference(value)) return;
        setPreference(value);
        applyThemePreference(value);
      }}
      className={cn("inline-flex rounded-md border p-0.5", className)}
    >
      {THEME_PREFERENCES.map((option) => {
        const Icon = ICONS[option];
        return (
          <ToggleGroup.Item
            key={option}
            value={option}
            aria-label={labels[option]}
            title={labels[option]}
            className="inline-flex size-8 items-center justify-center rounded-sm text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
          >
            <Icon className="size-4" />
          </ToggleGroup.Item>
        );
      })}
    </ToggleGroup.Root>
  );
}
