import type { DbExecutor } from "@platform/db";
import { personalWorkspaceSlug } from "@platform/shared";
import { insertPersonalWorkspace } from "./workspaces.repository";

// ACC-030: setiap user punya tepat satu personal workspace, dibuat bersama user (transaksi yang sama).

/** Nama default "Workspace {nama}" (nama bisnis diganti user di pengaturan workspace). */
export function personalWorkspaceName(userName: string): string {
  const trimmed = userName.trim();
  return trimmed ? `Workspace ${trimmed}` : "Workspace";
}

/** `true` bila workspace baru dibuat (registrasi), `false` bila user sudah punya. */
export async function ensurePersonalWorkspace(
  executor: DbExecutor,
  user: { id: string; name: string },
): Promise<boolean> {
  const created = await insertPersonalWorkspace(executor, {
    userId: user.id,
    name: personalWorkspaceName(user.name),
    slug: personalWorkspaceSlug(),
  });
  return created !== null;
}
