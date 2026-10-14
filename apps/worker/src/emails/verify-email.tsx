import { Button, Section, Text } from "react-email";
import { type BaseEmailProps, EmailLayout, emailButton, emailCopy, emailText } from "./layout";

// ACC-003: tautan bertoken (24 jam) + kode 6 digit untuk perangkat lain. Tanpa `code` = ganti email (ACC-008):
// dikirim ke alamat BARU, hanya tautan (kode OTP terikat alamat yang sudah tersimpan).
export function VerifyEmailEmail({
  locale,
  name,
  verifyUrl,
  code,
}: BaseEmailProps & { verifyUrl: string; code?: string }) {
  const text = emailCopy(locale, "auth.verify_email");
  return (
    <EmailLayout locale={locale} preview={code ? text("preview", { code }) : text("change_subject")}>
      <Text style={emailText}>{text("greeting", { name })}</Text>
      <Text style={emailText}>{code ? text("body") : text("change_body")}</Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={verifyUrl} style={emailButton}>
          {text("cta")}
        </Button>
      </Section>
      {code ? (
        <>
          <Text style={emailText}>{text("code")}</Text>
          <Text
            style={{
              ...emailText,
              fontFamily: "Menlo, Consolas, monospace",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 6,
            }}
          >
            {code}
          </Text>
        </>
      ) : null}
      <Text style={emailText}>{text("ignore")}</Text>
    </EmailLayout>
  );
}
