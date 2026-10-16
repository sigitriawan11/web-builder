"use client";

import { cn } from "@platform/ui";
import { GlobeIcon, UserIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const ITEMS = [
  { href: "/sites", key: "sites", Icon: GlobeIcon },
  { href: "/account", key: "account", Icon: UserIcon },
] as const;

export function SidebarNav() {
  const t = useTranslations("dashboard.nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} className="flex flex-col gap-1">
      {ITEMS.map(({ href, key, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <a
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              active && "bg-accent font-medium text-accent-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {t(key)}
          </a>
        );
      })}
    </nav>
  );
}
