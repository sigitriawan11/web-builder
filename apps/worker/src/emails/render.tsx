import { type Locale, t } from "@platform/i18n";
import type { JobPayload } from "@platform/shared/contracts";
import { render } from "react-email";
import { AccountExistsEmail } from "./account-exists";

// Template email per jenis job (`JOB_PAYLOADS.email.template`). Subjek & isi dari @platform/i18n sesuai users.locale.

export type EmailTemplate = JobPayload<"email">["template"];

export interface EmailRecipientProps {
  locale: Locale;
  name: string;
  appUrl: string;
}

const TEMPLATES = {
  account_exists: (props: EmailRecipientProps) => <AccountExistsEmail {...props} />,
} satisfies Record<EmailTemplate, (props: EmailRecipientProps) => React.ReactElement>;

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export async function renderEmail(template: EmailTemplate, props: EmailRecipientProps): Promise<RenderedEmail> {
  const element = TEMPLATES[template](props);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject: t(props.locale, "emails", `${template}.subject`), html, text };
}
