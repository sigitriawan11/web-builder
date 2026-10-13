import { type Db, eq, schema } from "@platform/db";

// Data penerima email. `users` = identitas platform (bukan data tenant), jadi tidak di-scope workspace/site.

export async function findEmailRecipient(db: Db, userId: string) {
  const [recipient] = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, locale: schema.users.locale })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  return recipient;
}
