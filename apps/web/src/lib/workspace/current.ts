import "server-only";
import type { Profile, WorkspaceListItem } from "@platform/shared/contracts";
import { redirect } from "next/navigation";
import { cache } from "react";
import { apiServerGet } from "../api/server";

// Data sesi dashboard (profil + workspace) — `cache` React: layout & halaman berbagi satu panggilan api per render.
// Workspace aktif M1 = personal (pertama di `GET /v1/workspaces`); pemilihan workspace tim menyusul (M9).

export interface DashboardSession {
  profile: Profile;
  workspaces: WorkspaceListItem[];
  current: WorkspaceListItem;
}

export const getDashboardSession = cache(async (): Promise<DashboardSession> => {
  const [profile, workspaces] = await Promise.all([
    apiServerGet<{ data: Profile }>("/v1/account/profile"),
    apiServerGet<{ data: WorkspaceListItem[] }>("/v1/workspaces"),
  ]);
  // Sesi tidak valid (cookie basi; proxy hanya memeriksa keberadaan) → login.
  if (profile.status === 401 || workspaces.status === 401 || !profile.body || !workspaces.body) redirect("/login");
  const current = workspaces.body.data[0];
  if (!current) throw new Error("user tanpa workspace (ACC-030 dilanggar)");
  return { profile: profile.body.data, workspaces: workspaces.body.data, current };
});
