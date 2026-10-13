import { sql } from "drizzle-orm";
import { boolean, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "../columns";

// Identitas platform (spec 08 ACC-370, ARCHITECTURE §6.3) dengan bentuk yang diharapkan Better Auth
// (drizzle adapter, `usePlural: true`, `generateId` = uuidv7 — dipasang di T1.5.1). Nama field TS mengikuti
// model Better Auth (`emailVerified`, `expiresAt`, `providerId`, …); kolom DB snake_case lewat casing.
// Kolom fase lanjut (telepon, risk_score, signup_meta, impersonation, 2FA) ditambah saat fiturnya dibangun.

const timestamptz = () => timestamp({ withTimezone: true });

export const localeEnum = pgEnum("locale", ["id", "en"]);
// spec 08 ACC-370: status akun; waktu kejadian dicatat di audit log.
export const userStatusEnum = pgEnum("user_status", ["active", "pending_deletion", "suspended", "banned"]);
// spec 08 §10.1: role staf platform (terpisah dari role workspace); null = user biasa.
export const staffRoleEnum = pgEnum("staff_role", ["super_admin", "staff", "library_admin", "designer"]);

export const users = pgTable(
  "users",
  {
    id: id(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    locale: localeEnum().notNull().default("id"),
    timezone: text().notNull().default("Asia/Jakarta"),
    staffRole: staffRoleEnum(),
    status: userStatusEnum().notNull().default("active"),
    lastActiveAt: timestamptz(),
    ...timestamps,
  },
  // Email unik tanpa membedakan huruf besar/kecil (ARCHITECTURE §6.3).
  (table) => [uniqueIndex("users_email_lower_key").on(sql`lower(${table.email})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text().notNull().unique(),
    expiresAt: timestamptz().notNull(),
    ipAddress: text(),
    userAgent: text(),
    ...timestamps,
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

// OAuth (Google) & credential (email + password hash).
export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerId: text().notNull(),
    accountId: text().notNull(),
    password: text(),
    // Token OAuth disimpan terenkripsi (Better Auth `encryptOAuthTokens`, T1.5.1).
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamptz(),
    refreshTokenExpiresAt: timestamptz(),
    scope: text(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("accounts_provider_account_key").on(table.providerId, table.accountId),
    index("accounts_user_id_idx").on(table.userId),
  ],
);

// Token verifikasi email, reset password, ganti email.
export const verifications = pgTable(
  "verifications",
  {
    id: id(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamptz().notNull(),
    ...timestamps,
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);
