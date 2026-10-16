import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { APP_URL } from "../../playwright.config";

export const PASSWORD = "Kopi-Susu-Gula-Aren-42";

// T1.16.4: user owner terverifikasi + sesi login dari global setup (`e2e/global-setup.ts`).
export const OWNER_STATE = new URL("../.auth/owner.json", import.meta.url).pathname;
export const OWNER_ACCOUNT = new URL("../.auth/owner-account.json", import.meta.url).pathname;

export function ownerAccount(): { email: string; password: string } {
  return JSON.parse(readFileSync(OWNER_ACCOUNT, "utf8")) as { email: string; password: string };
}

/** Daftar lewat form `/register` (UI bahasa Inggris: konteks `locale: en-US`). */
export async function register(page: Page, email: string, password = PASSWORD, name = "Sari Wulandari") {
  await page.goto(`${APP_URL}/register`);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("checkbox", { name: /I agree to the/ }).check();
  await page.getByRole("button", { name: "Sign up" }).click();
}

export async function login(page: Page, email: string, password: string, next?: string) {
  await page.goto(`${APP_URL}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
