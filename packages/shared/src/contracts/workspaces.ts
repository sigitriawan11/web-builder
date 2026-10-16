import { z } from "zod";

// Role tetap workspace (spec 08 ACC-033): satu `owner` per workspace.
export const WorkspaceRoleSchema = z.enum(["owner", "admin", "editor", "viewer", "billing"]);
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;

// `GET /v1/workspaces/:workspaceId/me` (ACC-033): role user di workspace + aksi yang boleh (UI menyembunyikan aksi).
export const WorkspaceMeSchema = z.object({
  workspace: z.object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string(),
    type: z.enum(["personal", "team"]),
  }),
  role: WorkspaceRoleSchema,
  permissions: z.array(z.string()),
});
export type WorkspaceMe = z.infer<typeof WorkspaceMeSchema>;

// `GET /v1/workspaces` (T1.14.5): workspace aktif tempat user menjadi anggota (switcher dashboard). Personal dulu.
export const WorkspaceListItemSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  type: z.enum(["personal", "team"]),
  role: WorkspaceRoleSchema,
});
export type WorkspaceListItem = z.infer<typeof WorkspaceListItemSchema>;
