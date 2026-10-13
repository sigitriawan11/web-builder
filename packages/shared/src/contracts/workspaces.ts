import { z } from "zod";

// Role tetap workspace (spec 08 ACC-033): satu `owner` per workspace.
export const WorkspaceRoleSchema = z.enum(["owner", "admin", "editor", "viewer", "billing"]);
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;
