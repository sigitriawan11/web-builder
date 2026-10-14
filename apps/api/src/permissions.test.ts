import { workspaceScope } from "@platform/db";
import { isAppError } from "@platform/shared";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { canActor, requirePermission } from "./permissions";

const USER = "01a135f2-b67d-71b3-9fbc-775f6ef635e9";
const RUN = "01a135f2-b6cc-77fb-893d-af4f62d11c71";
const WORKSPACE = "01a135f2-b6cc-77fb-893d-af4f62d11c72";

describe("canActor", () => {
  it("staf platform (impersonation) hanya boleh membaca", () => {
    const staff = { type: "staff" as const, userId: USER };
    expect(canActor(staff, "site.read")).toBe(true);
    expect(canActor(staff, "billing.read")).toBe(true);
    expect(canActor(staff, "site.edit")).toBe(false);
    expect(canActor(staff, "site.publish")).toBe(false);
  });

  it("AI bertindak dengan role user yang memulai run", () => {
    expect(canActor({ type: "ai", userId: USER, role: "editor", runId: RUN }, "site.edit")).toBe(true);
    expect(canActor({ type: "ai", userId: USER, role: "viewer", runId: RUN }, "site.edit")).toBe(false);
  });
});

describe("requirePermission", () => {
  const run = (role: "owner" | "viewer" | null) => {
    const req = {
      ctx: {
        requestId: "r",
        ...(role
          ? { tenant: workspaceScope({ workspaceId: WORKSPACE, actor: { type: "user", userId: USER, role } }) }
          : {}),
      },
    } as unknown as Request;
    const next = vi.fn() as NextFunction;
    try {
      requirePermission("site.create")(req, {} as Response, next);
      return { next, error: undefined };
    } catch (error) {
      return { next, error };
    }
  };

  it("boleh → next()", () => {
    expect(run("owner").next).toHaveBeenCalledOnce();
  });

  it("role kurang → AppError FORBIDDEN dengan aksi", () => {
    const { error, next } = run("viewer");
    expect(isAppError(error) && error.code).toBe("FORBIDDEN");
    expect(next).not.toHaveBeenCalled();
  });

  it("tanpa tenantResolver → error program (bukan 403)", () => {
    const { error } = run(null);
    expect(isAppError(error)).toBe(false);
    expect(String(error)).toMatch(/tanpa tenantResolver/);
  });
});
