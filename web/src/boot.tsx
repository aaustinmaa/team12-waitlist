// Shared start-up for the three entry pages (family app, clinic portal, demo
// guide). Each page has its own HTML file and its own routes; they share the
// same data store, so on one device a change in one shows up in the other.

import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { I18nProvider } from "./lib/i18n";
import { PlatformProvider } from "./platform/store";

export function mount(app: ReactNode) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <PlatformProvider>
        <I18nProvider>{app}</I18nProvider>
      </PlatformProvider>
    </StrictMode>,
  );
}

/** Public addresses of the two apps, for links and QR codes. */
export const PUBLIC_BASE = "https://aaustinmaa.github.io/team12-waitlist/";
export const PUBLIC_URLS = { family: PUBLIC_BASE, clinic: `${PUBLIC_BASE}clinic/` };
