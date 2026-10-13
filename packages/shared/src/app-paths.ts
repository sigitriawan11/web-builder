// Path halaman `apps/web` yang dirujuk dari luar web (link email, redirect api). Satu sumber agar link email tidak
// patah saat route web dibuat (T1.14.4). Relatif terhadap PUBLIC_APP_URL.
export const APP_PATHS = {
  login: "/login",
  forgotPassword: "/forgot-password",
} as const;
