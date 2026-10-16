import { Redis } from "ioredis";
import { E2E_REDIS_URL, MAILPIT_API } from "../../playwright.config";

// Helper e2e untuk stack khusus (T1.14.4): reset rate limit di Redis e2e & baca email dari Mailpit.

/**
 * Hapus kunci rate limit / kunci login / cooldown di Redis DB e2e (bukan antrean BullMQ `bull:*` maupun cache sesi
 * `auth:*`) — semua test datang dari satu IP, batas registrasi 3/jam akan cepat tercapai.
 */
export async function resetRateLimits(): Promise<void> {
  const redis = new Redis(E2E_REDIS_URL, { maxRetriesPerRequest: 1 });
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "COUNT", 500);
      cursor = next;
      const doomed = keys.filter((key) => !key.startsWith("bull:") && !key.startsWith("auth:"));
      if (doomed.length > 0) await redis.del(...doomed);
    } while (cursor !== "0");
  } finally {
    redis.disconnect();
  }
}

export const uniqueEmail = (label: string) =>
  `e2e-${label}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@platform.test`;

interface MailSummary {
  ID: string;
  Subject: string;
}

/** Email terbaru ke `address` yang subjeknya cocok; menunggu worker mengirimnya (antrean `email`). */
export async function waitForEmail(address: string, subject: RegExp, timeoutMs = 20_000): Promise<{ text: string }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const search = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:"${address}"`)}`);
    const { messages } = (await search.json()) as { messages: MailSummary[] };
    const match = messages.find((message) => subject.test(message.Subject));
    if (match) {
      const detail = (await (await fetch(`${MAILPIT_API}/message/${match.ID}`)).json()) as { Text: string };
      return { text: detail.Text };
    }
    if (Date.now() > deadline) throw new Error(`email "${subject}" ke ${address} tidak datang`);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

/** URL pertama di teks email yang path-nya memuat `fragment`. */
export function linkIn(text: string, fragment: string): string {
  const url = (text.match(/https?:\/\/[^\s)>\]]+/g) ?? []).find((candidate) => candidate.includes(fragment));
  if (!url) throw new Error(`tautan ${fragment} tidak ada di email`);
  return url;
}
