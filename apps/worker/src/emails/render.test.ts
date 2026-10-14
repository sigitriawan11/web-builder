import { LOCALES } from "@platform/i18n";
import { describe, expect, it } from "vitest";
import { type EmailJob, renderEmail } from "./render";

// T1.5.13: snapshot HTML setiap template × bahasa (file .html bisa dibuka di browser untuk review visual) + isi
// penting per template. Snapshot berubah = tampilan email berubah → tinjau diff-nya sebelum `vitest -u`.

const appUrl = "http://app.localhost:3000";
const base = { requestId: "req-snapshot", userId: "01a135f2-b67d-71b3-9fbc-775f6ef635e9" };
const verifyUrl = "http://app.localhost:3000/api/auth/verify-email?token=tok_verify";
const resetUrl = "http://app.localhost:3000/api/auth/reset-password/tok_reset?callbackURL=%2Freset-password";

const JOBS: EmailJob[] = [
  { ...base, template: "auth.welcome" },
  { ...base, template: "auth.account_exists" },
  { ...base, template: "auth.verify_email", verifyUrl, code: "482915" },
  { ...base, template: "auth.password_reset", resetUrl },
  { ...base, template: "auth.password_changed" },
];

// Link wajib per template (selain itu isi diuji lewat snapshot).
const EXPECTED_LINKS: Record<EmailJob["template"], string[]> = {
  "auth.welcome": [`${appUrl}/`],
  "auth.account_exists": [`${appUrl}/login`, `${appUrl}/forgot-password`],
  "auth.verify_email": [verifyUrl],
  "auth.password_reset": [resetUrl],
  "auth.password_changed": [`${appUrl}/forgot-password`],
};

const escapeHref = (url: string) => url.replaceAll("&", "&amp;");

describe.each(LOCALES)("template email (%s)", (locale) => {
  it.each(JOBS.map((job) => [job.template, job] as const))("%s", async (template, job) => {
    const email = await renderEmail(job, { locale, name: "Budi Santoso" }, appUrl);
    await expect(email.html).toMatchFileSnapshot(`./__snapshots__/${template}.${locale}.html`);
    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.html).toContain(`lang="${locale}"`);
    expect(email.html).toContain("Budi Santoso");
    for (const link of EXPECTED_LINKS[template]) expect(email.html).toContain(`href="${escapeHref(link)}"`);
    expect(email.text).toContain("Budi Santoso");
    expect(email.text).not.toMatch(/<[a-z]/i);
  });
});

describe("isi khusus", () => {
  it("verifikasi: kode 6 digit di isi & preview (ID/EN berbeda subjek)", async () => {
    const job: EmailJob = { ...base, template: "auth.verify_email", verifyUrl, code: "482915" };
    const id = await renderEmail(job, { locale: "id", name: "Budi" }, appUrl);
    const en = await renderEmail(job, { locale: "en", name: "Budi" }, appUrl);
    expect(id.subject).toBe("Verifikasi email Anda");
    expect(en.subject).toBe("Verify your email");
    expect(id.text).toContain("482915");
    expect(id.html).toContain("Kode verifikasi Anda: 482915");
  });

  it("ganti email (verifikasi tanpa kode): subjek & isi khusus, tanpa blok kode", async () => {
    const job: EmailJob = { ...base, template: "auth.verify_email", verifyUrl, email: "baru@contoh.id" };
    const email = await renderEmail(job, { locale: "id", name: "Budi" }, appUrl);
    expect(email.subject).toBe("Konfirmasi alamat email baru Anda");
    expect(email.text).toContain("email lama tetap aktif");
    expect(email.text).not.toMatch(/\b\d{6}\b/);
    expect(email.html).toContain(`href="${escapeHref(verifyUrl)}"`);
  });

  it("nama user di-escape (bukan HTML mentah)", async () => {
    const email = await renderEmail(
      { ...base, template: "auth.welcome" },
      { locale: "id", name: '<img src=x onerror="alert(1)">' },
      appUrl,
    );
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;img");
  });
});
