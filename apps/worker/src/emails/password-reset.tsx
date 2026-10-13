import { Button, Section, Text } from "react-email";
import { type BaseEmailProps, EmailLayout, emailButton, emailCopy, emailText } from "./layout";

// ACC-005: tautan reset (1 jam, sekali pakai).
export function PasswordResetEmail({ locale, name, resetUrl }: BaseEmailProps & { resetUrl: string }) {
  const text = emailCopy(locale, "auth.password_reset");
  return (
    <EmailLayout locale={locale} preview={text("preview")}>
      <Text style={emailText}>{text("greeting", { name })}</Text>
      <Text style={emailText}>{text("body")}</Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={resetUrl} style={emailButton}>
          {text("cta")}
        </Button>
      </Section>
      <Text style={emailText}>{text("ignore")}</Text>
    </EmailLayout>
  );
}
