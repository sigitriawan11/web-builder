import { WorkspaceRoleSchema } from "@platform/shared/contracts";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { workspaceMembers, workspaceRoleEnum, workspaces } from "./workspaces";

describe("schema workspaces (spec 08 ACC-030, ACC-370)", () => {
  it("enum role DB = WorkspaceRoleSchema di contracts (satu daftar role, tidak boleh beda)", () => {
    expect(workspaceRoleEnum.enumValues).toEqual(WorkspaceRoleSchema.options);
  });

  it("paket tidak disimpan di workspaces (diturunkan dari subscriptions, M5)", () => {
    expect(Object.keys(getTableColumns(workspaces))).not.toEqual(expect.arrayContaining(["planCode"]));
  });

  it("keanggotaan: role wajib, joinedAt default now()", () => {
    const columns = getTableColumns(workspaceMembers);
    expect(columns.role.notNull).toBe(true);
    expect(columns.joinedAt.hasDefault).toBe(true);
  });
});
