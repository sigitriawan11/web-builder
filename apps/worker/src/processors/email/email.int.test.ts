import { eq, schema } from "@platform/db";
import { createTestDb, createUser, type TestDb } from "@platform/db/testing";
import { uuidv7 } from "@platform/shared";
import { QUEUE_POLICIES } from "@platform/shared/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { smtpProvider } from "../../email/provider";
import { createWorkerLogger } from "../../worker-process";
import { createEmailProcessor } from "./email.processor";

// T1.13.2: job email → render sesuai bahasa user → SMTP → tertangkap Mailpit (butuh `pnpm infra:up`).
const smtpUrl = process.env.SMTP_URL ?? "smtp://localhost:1025";
const mailpitApi = `http://localhost:${process.env.MAILPIT_UI_PORT ?? "8025"}/api/v1`;
const logger = createWorkerLogger({ APP_ENV: "local", LOG_LEVEL: "fatal" }, { write: () => {} });
const appUrl = "http://app.localhost:3000";

interface MailpitSummary {
  ID: string;
  Subject: string;
}

async function messagesTo(address: string): Promise<MailpitSummary[]> {
  const response = await fetch(`${mailpitApi}/search?query=${encodeURIComponent(`to:"${address}"`)}`);
  return ((await response.json()) as { messages: MailpitSummary[] }).messages;
}

let testDb: TestDb;
const provider = smtpProvider(smtpUrl);
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  provider.close?.();
  await testDb.drop();
});

const context = () => ({ jobId: uuidv7(), attempt: 1, signal: new AbortController().signal, logger });
const processor = () =>
  createEmailProcessor({ db: testDb.db, provider, from: "Platform <no-reply@platformmu.com>", appUrl });

describe("processor email (ACC-271)", () => {
  it.each([
    ["id", "Anda sudah punya akun Platform", "Masuk ke akun Anda"],
    ["en", "You already have a Platform account", "Sign in to your account"],
  ] as const)(
    "account_exists (%s) tertangkap Mailpit dengan subjek & link sesuai bahasa",
    async (locale, subject, cta) => {
      const email = `mail.${uuidv7()}@platform.test`;
      const { user } = await createUser(testDb.db, { email, name: "Budi Santoso" });
      await testDb.db.update(schema.users).set({ locale }).where(eq(schema.users.id, user.id));

      await processor()({ requestId: `req-${uuidv7()}`, template: "auth.account_exists", userId: user.id }, context());

      await expect.poll(() => messagesTo(email), { timeout: 5_000 }).toHaveLength(1);
      const [summary] = await messagesTo(email);
      expect(summary?.Subject).toBe(subject);
      const detail = (await (await fetch(`${mailpitApi}/message/${summary?.ID}`)).json()) as {
        HTML: string;
        Text: string;
        From: { Address: string };
      };
      expect(detail.From.Address).toBe("no-reply@platformmu.com");
      expect(detail.HTML).toContain(cta);
      expect(detail.HTML).toContain(`${appUrl}/login`);
      expect(detail.Text).toContain("Budi Santoso");
    },
  );

  it("ganti email: verifikasi dikirim ke alamat BARU (bukan alamat tersimpan)", async () => {
    const oldEmail = `lama.${uuidv7()}@platform.test`;
    const newEmail = `baru.${uuidv7()}@platform.test`;
    const { user } = await createUser(testDb.db, { email: oldEmail });
    await processor()(
      {
        requestId: `req-${uuidv7()}`,
        template: "auth.verify_email",
        userId: user.id,
        verifyUrl: `${appUrl}/api/auth/verify-email?token=abc`,
        email: newEmail,
      },
      context(),
    );
    await expect.poll(() => messagesTo(newEmail), { timeout: 5_000 }).toHaveLength(1);
    expect(await messagesTo(oldEmail)).toHaveLength(0);
  });

  it("user sudah tidak ada → selesai tanpa mengirim (tidak di-retry)", async () => {
    await expect(
      processor()({ requestId: `req-${uuidv7()}`, template: "auth.account_exists", userId: uuidv7() }, context()),
    ).resolves.toBeUndefined();
  });

  it("SMTP tidak terjangkau → error (BullMQ me-retry 5× / exp 30 s)", async () => {
    const { user } = await createUser(testDb.db);
    const down = smtpProvider("smtp://127.0.0.1:1");
    const failing = createEmailProcessor({ db: testDb.db, provider: down, from: "a@b.c", appUrl });
    await expect(
      failing({ requestId: `req-${uuidv7()}`, template: "auth.account_exists", userId: user.id }, context()),
    ).rejects.toThrow();
    down.close?.();
    expect(QUEUE_POLICIES.email).toMatchObject({ attempts: 5, backoff: { type: "exponential", delayMs: 30_000 } });
  });
});
