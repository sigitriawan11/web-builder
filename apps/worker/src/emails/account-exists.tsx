import { type Locale, t } from "@platform/i18n";
import { APP_PATHS } from "@platform/shared";
import { Button, Link, Section, Text } from "react-email";
import { EmailLayout, emailButton, emailText } from "./layout";

// ACC-001: dikirim saat seseorang mendaftar dengan email yang sudah terdaftar (respons API tetap generik).

export interface AccountExistsProps {
  locale: Locale;
  name: string;
  appUrl: string;
}

export function AccountExistsEmail({ locale, name, appUrl }: AccountExistsProps) {
  const text = (key: string, values?: Record<string, string>) => t(locale, "emails", `account_exists.${key}`, values);
  return (
    <EmailLayout locale={locale} preview={text("preview")}>
      <Text style={emailText}>{text("greeting", { name })}</Text>
      <Text style={emailText}>{text("body")}</Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={`${appUrl}${APP_PATHS.login}`} style={emailButton}>
          {text("cta")}
        </Button>
      </Section>
      <Text style={emailText}>
        <Link href={`${appUrl}${APP_PATHS.forgotPassword}`}>{text("forgot")}</Link>
      </Text>
      <Text style={emailText}>{text("ignore")}</Text>
    </EmailLayout>
  );
}
