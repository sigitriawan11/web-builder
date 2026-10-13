import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { accounts, sessions, users, verifications } from "./identity";

// Field minimal yang dibaca/ditulis Better Auth (drizzle adapter, T1.5.1). Mengganti nama field ini
// membuat auth gagal saat runtime, bukan saat typecheck.
const BETTER_AUTH_FIELDS = {
  users: ["id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt"],
  sessions: ["id", "userId", "token", "expiresAt", "ipAddress", "userAgent", "createdAt", "updatedAt"],
  accounts: [
    "id",
    "userId",
    "providerId",
    "accountId",
    "password",
    "accessToken",
    "refreshToken",
    "idToken",
    "accessTokenExpiresAt",
    "refreshTokenExpiresAt",
    "scope",
    "createdAt",
    "updatedAt",
  ],
  verifications: ["id", "identifier", "value", "expiresAt", "createdAt", "updatedAt"],
};

describe("schema identity (spec 08 ACC-370)", () => {
  it.each([
    ["users", users],
    ["sessions", sessions],
    ["accounts", accounts],
    ["verifications", verifications],
  ] as const)("%s memuat field yang diharapkan Better Auth", (name, table) => {
    expect(Object.keys(getTableColumns(table))).toEqual(expect.arrayContaining(BETTER_AUTH_FIELDS[name]));
  });

  it("users: kolom tambahan platform dengan default M1", () => {
    const columns = getTableColumns(users);
    expect(columns.locale.default).toBe("id");
    expect(columns.timezone.default).toBe("Asia/Jakarta");
    expect(columns.status.default).toBe("active");
    expect(columns.status.enumValues).toEqual(["active", "pending_deletion", "suspended", "banned"]);
    expect(columns.staffRole.notNull).toBe(false);
    expect(columns.staffRole.enumValues).toEqual(["super_admin", "staff", "library_admin", "designer"]);
  });
});
