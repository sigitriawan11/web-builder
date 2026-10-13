import { APP_PATHS } from "@platform/shared";
import { Button, Section, Text } from "react-email";
import { type BaseEmailProps, EmailLayout, emailButton, emailCopy, emailText } from "./layout";

// ACC-005: notifikasi setelah password diubah/di-reset (sesi lain sudah dicabut).
export function PasswordChangedEmail({ locale, name, appUrl }: BaseEmailProps) {
  const text = emailCopy(locale, "auth.password_changed");
  return (
    <EmailLayout locale={locale} preview={text("preview")}>
      <Text style={emailText}>{text("greeting", { name })}</Text>
      <Text style={emailText}>{text("body")}</Text>
      <Text style={{ ...emailText, fontWeight: 600 }}>{text("warning")}</Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={`${appUrl}${APP_PATHS.forgotPassword}`} style={emailButton}>
          {text("cta")}
        </Button>
      </Section>
    </EmailLayout>
  );
}
