import { UnrecoverableError } from "bullmq";
import nodemailer from "nodemailer";

// Pengirim email (ACC-271) di balik satu interface: SMTP (Mailpit lokal) atau Resend (production).
// Klasifikasi error: kegagalan permanen (alamat ditolak, request tidak valid) → UnrecoverableError (tidak di-retry);
// selain itu (jaringan, 429, 5xx) → error biasa, di-retry BullMQ sesuai QUEUE_POLICIES.email (5× / exp 30 s).

export interface EmailMessage {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  // Mencegah email ganda bila job di-retry setelah provider menerima (didukung Resend).
  idempotencyKey: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ providerMessageId: string }>;
  close?(): void;
}

export type EmailProviderConfig =
  | { provider: "smtp"; smtpUrl: string }
  | { provider: "resend"; apiKey: string; endpoint?: string };

export function smtpProvider(smtpUrl: string): EmailProvider {
  const transport = nodemailer.createTransport(smtpUrl);
  return {
    async send(message) {
      try {
        const info = await transport.sendMail({
          from: message.from,
          to: message.to,
          ...(message.replyTo ? { replyTo: message.replyTo } : {}),
          subject: message.subject,
          html: message.html,
          text: message.text,
        });
        return { providerMessageId: info.messageId };
      } catch (error) {
        // Kode SMTP 5xx = penolakan permanen (mis. mailbox tidak ada); 4xx & error koneksi = sementara.
        const code = (error as { responseCode?: unknown }).responseCode;
        if (typeof code === "number" && code >= 500) {
          throw new UnrecoverableError(`SMTP menolak permanen (${code})`);
        }
        throw error;
      }
    },
    close: () => transport.close(),
  };
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function resendProvider(apiKey: string, endpoint: string = RESEND_ENDPOINT): EmailProvider {
  return {
    async send(message) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "idempotency-key": message.idempotencyKey,
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) {
        const body = (await response.json()) as { id?: unknown };
        return { providerMessageId: typeof body.id === "string" ? body.id : "" };
      }
      // Isi body error tidak dicatat utuh: bisa memuat alamat penerima.
      await response.body?.cancel();
      if (response.status === 429 || response.status >= 500) throw new Error(`Resend HTTP ${response.status}`);
      throw new UnrecoverableError(`Resend menolak request (HTTP ${response.status})`);
    },
  };
}

export function createEmailProvider(config: EmailProviderConfig): EmailProvider {
  return config.provider === "smtp" ? smtpProvider(config.smtpUrl) : resendProvider(config.apiKey, config.endpoint);
}
