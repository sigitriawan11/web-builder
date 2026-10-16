import "server-only";
import type { Profile, WorkspaceListItem } from "@platform/shared/contracts";
import { cache } from "react";
import { withSession } from "../api/server";

// Data sesi dashboard (profil + workspace) — `cache` React: layout & halaman berbagi satu panggilan api per render.
// Workspace aktif M1 = personal (pertama di `GET /v1/workspaces`); pemilihan workspace tim menyusul (M9).

export interface DashboardSession {
  profile: Profile;
  workspaces: WorkspaceListItem[];
  current: WorkspaceListItem;
}

export const getDashboardSession = cache(async (): Promise<DashboardSession> => {
  // Sesi tidak valid (cookie basi; proxy hanya memeriksa keberadaan) → login.
  const [profile, workspaces] = await withSession((api) => Promise.all([api.account.profile(), api.workspaces.list()]));
  const current = workspaces[0];
  if (!current) throw new Error("user tanpa workspace (ACC-030 dilanggar)");
  return { profile, workspaces, current };
});
