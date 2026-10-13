import type { Db } from "@platform/db";
import type { EmailProvider } from "../../email/provider";
import { renderEmail } from "../../emails/render";
import type { JobHandler } from "../types";
import { findEmailRecipient } from "./email.repository";

// Processor queue `email` (ARCHITECTURE §5.4, ACC-271): muat penerima → render template dalam bahasa user → kirim.
// Pencatatan ke tabel `notifications` (provider_message_id, status) menyusul bersama tabelnya (T4.13.10);
// sampai itu, `providerMessageId` dicatat di log terstruktur.

export interface EmailProcessorDeps {
  db: Db;
  provider: EmailProvider;
  from: string;
  replyTo?: string;
  // PUBLIC_APP_URL: basis link di email.
  appUrl: string;
}

export function createEmailProcessor(deps: EmailProcessorDeps): JobHandler<"email"> {
  return async (payload, { jobId, logger }) => {
    const recipient = await findEmailRecipient(deps.db, payload.userId);
    if (!recipient) {
      // User sudah dihapus sejak job dibuat: tidak ada yang perlu dikirim, retry tidak akan membantu.
      logger.warn({ userId: payload.userId, template: payload.template }, "penerima email tidak ditemukan; dilewati");
      return;
    }
    const email = await renderEmail(payload, { locale: recipient.locale, name: recipient.name }, deps.appUrl);
    const { providerMessageId } = await deps.provider.send({
      from: deps.from,
      to: recipient.email,
      ...(deps.replyTo ? { replyTo: deps.replyTo } : {}),
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: `email:${jobId}`,
    });
    // Alamat email tidak dicatat (PII); userId cukup untuk penelusuran.
    logger.info({ userId: recipient.id, template: payload.template, providerMessageId }, "email terkirim");
  };
}
