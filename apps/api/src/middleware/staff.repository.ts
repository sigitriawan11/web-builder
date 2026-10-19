import { type Db, eq, schema } from "@platform/db";

export type StaffRole = (typeof schema.staffRoleEnum.enumValues)[number];

/** Role staf platform user (spec 08 §10.1); `null` = user biasa. Dibaca per request oleh `requireStaffRole`. */
export async function findStaffRole(db: Db, userId: string): Promise<StaffRole | null> {
  const rows = await db
    .select({ staffRole: schema.users.staffRole })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return rows[0]?.staffRole ?? null;
}
