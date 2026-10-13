import { APP_PATHS } from "@platform/shared";
import { Button, Section, Text } from "react-email";
import { type BaseEmailProps, EmailLayout, emailButton, emailCopy, emailText } from "./layout";

// Katalog ACC-270 `auth.welcome`: setelah registrasi.
export function WelcomeEmail({ locale, name, appUrl }: BaseEmailProps) {
  const text = emailCopy(locale, "auth.welcome");
  return (
    <EmailLayout locale={locale} preview={text("preview")}>
      <Text style={emailText}>{text("greeting", { name })}</Text>
      <Text style={emailText}>{text("body")}</Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={`${appUrl}${APP_PATHS.dashboard}`} style={emailButton}>
          {text("cta")}
        </Button>
      </Section>
    </EmailLayout>
  );
}
