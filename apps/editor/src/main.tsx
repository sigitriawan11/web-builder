import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { initialLocale } from "./app/i18n";
import { applyThemeFromCookie } from "./app/theme";
import "./styles/global.css";
import { initTelemetry } from "./telemetry/telemetry";

// Sebelum render: error bootstrap pun tercatat (ED-231).
initTelemetry();
applyThemeFromCookie();
document.documentElement.lang = initialLocale();
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Elemen #root tidak ditemukan di index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
