import { describe, expect, it } from "vitest";
import { renderEmail } from "./render";

const appUrl = "http://app.localhost:3000";

describe("renderEmail account_exists", () => {
  it.each([
    ["id", "Anda sudah punya akun Platform", "Halo Budi,"],
    ["en", "You already have a Platform account", "Hi Budi,"],
  ] as const)("%s: subjek, sapaan, link login & lupa password, versi teks", async (locale, subject, greeting) => {
    const email = await renderEmail("account_exists", { locale, name: "Budi", appUrl });
    expect(email.subject).toBe(subject);
    expect(email.html).toContain(`lang="${locale}"`);
    expect(email.html).toContain(greeting);
    expect(email.html).toContain(`href="${appUrl}/login"`);
    expect(email.html).toContain(`href="${appUrl}/forgot-password"`);
    expect(email.text).toContain(greeting);
    expect(email.text).not.toContain("<");
  });

  it("nama user di-escape (bukan HTML mentah)", async () => {
    const email = await renderEmail("account_exists", {
      locale: "id",
      name: '<img src=x onerror="alert(1)">',
      appUrl,
    });
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;img");
  });
});
