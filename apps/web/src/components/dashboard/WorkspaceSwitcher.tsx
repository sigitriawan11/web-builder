"use client";

import type { WorkspaceListItem } from "@platform/shared/contracts";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@platform/ui";
import { ChevronsUpDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";

// Switcher workspace (ACC-050) — placeholder M1: hanya menampilkan daftar; berpindah workspace hadir bersama team
// workspace (M9). Workspace aktif = personal (pertama di daftar `GET /v1/workspaces`).
export function WorkspaceSwitcher({
  workspaces,
  current,
}: {
  workspaces: WorkspaceListItem[];
  current: WorkspaceListItem;
}) {
  const t = useTranslations("dashboard.workspace");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between" aria-label={t("label")}>
          <span className="truncate">{current.name}</span>
          <ChevronsUpDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        {workspaces.map((workspace) => (
          <DropdownMenuItem key={workspace.id} disabled={workspace.id !== current.id}>
            <span className="truncate">{workspace.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">{t(workspace.type)}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs text-muted-foreground">{t("switchSoon")}</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
