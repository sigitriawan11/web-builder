import { type Locale, t } from "@platform/i18n";
import type { ReactNode } from "react";
import { Body, Container, Head, Hr, Html, Preview, Text } from "react-email";

// Kerangka semua email transaksional (ACC-271): satu kolom, gaya inline sederhana agar aman di klien email.

const styles = {
  body: { backgroundColor: "#f4f4f5", fontFamily: "Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" },
  container: { backgroundColor: "#ffffff", borderRadius: 8, margin: "0 auto", maxWidth: 520, padding: "32px" },
  brand: { color: "#18181b", fontSize: 20, fontWeight: 700, margin: "0 0 24px" },
  footer: { color: "#71717a", fontSize: 12, lineHeight: "18px", margin: 0 },
} as const;

export function EmailLayout(props: { locale: Locale; preview: string; children: ReactNode }) {
  return (
    <Html lang={props.locale}>
      <Head />
      <Preview>{props.preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>Platform</Text>
          {props.children}
          <Hr style={{ borderColor: "#e4e4e7", margin: "32px 0 16px" }} />
          <Text style={styles.footer}>{t(props.locale, "emails", "layout.footer")}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const emailText = { color: "#3f3f46", fontSize: 15, lineHeight: "24px", margin: "0 0 16px" } as const;
export const emailButton = {
  backgroundColor: "#18181b",
  borderRadius: 6,
  color: "#ffffff",
  display: "inline-block",
  fontSize: 15,
  fontWeight: 600,
  padding: "12px 20px",
  textDecoration: "none",
} as const;

/** Teks satu template dari namespace i18n `emails` (key `<template>.<bagian>`). */
export function emailCopy(locale: Locale, template: string) {
  return (key: string, values?: Readonly<Record<string, string>>) => t(locale, "emails", `${template}.${key}`, values);
}

/** Props bersama semua template: penerima + basis URL web. */
export interface BaseEmailProps {
  locale: Locale;
  name: string;
  appUrl: string;
}
