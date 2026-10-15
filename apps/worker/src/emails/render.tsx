import { type Locale, translate } from "@platform/i18n";
import type { JobPayload } from "@platform/shared/contracts";
import type { ReactElement } from "react";
import { render } from "react-email";
import { AccountExistsEmail } from "./account-exists";
import type { BaseEmailProps } from "./layout";
import { PasswordChangedEmail } from "./password-changed";
import { PasswordResetEmail } from "./password-reset";
import { VerifyEmailEmail } from "./verify-email";
import { WelcomeEmail } from "./welcome";

// Template email per job (`JOB_PAYLOADS.email`, nama = type katalog ACC-270). Subjek & isi dari @platform/i18n
// sesuai users.locale. `switch` atas union payload: tiap template menerima data spesifiknya dengan tipe tepat.

export type EmailJob = JobPayload<"email">;
export type EmailTemplate = EmailJob["template"];

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function emailElement(job: EmailJob, props: BaseEmailProps): ReactElement {
  switch (job.template) {
    case "auth.welcome":
      return <WelcomeEmail {...props} />;
    case "auth.account_exists":
      return <AccountExistsEmail {...props} />;
    case "auth.verify_email":
      return <VerifyEmailEmail {...props} verifyUrl={job.verifyUrl} {...(job.code ? { code: job.code } : {})} />;
    case "auth.password_reset":
      return <PasswordResetEmail {...props} resetUrl={job.resetUrl} />;
    case "auth.password_changed":
      return <PasswordChangedEmail {...props} />;
  }
}

export async function renderEmail(
  job: EmailJob,
  recipient: { locale: Locale; name: string },
  appUrl: string,
): Promise<RenderedEmail> {
  const element = emailElement(job, { ...recipient, appUrl });
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  // Ganti email (verifikasi alamat baru, tanpa kode) memakai subjek sendiri.
  const subjectKey =
    job.template === "auth.verify_email" && !job.code ? "auth.verify_email.change_subject" : `${job.template}.subject`;
  return { subject: translate(recipient.locale, "emails", subjectKey), html, text };
}
