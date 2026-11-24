// The printed poster has QR codes for three fixed addresses on the live site:
//   /               family app
//   /clinic/?local  clinic portal (a private demo copy on each phone)
//   /refer/         referrer page
// Every merge to main redeploys to those same addresses, so the codes keep
// working across new versions only while these three pages exist where they
// are. This test fails if one is moved, renamed or dropped from the build.

import { describe, expect, it } from "vitest";
import familyHtml from "../index.html?raw";
import clinicHtml from "../clinic/index.html?raw";
import referHtml from "../refer/index.html?raw";
import viteConfig from "../vite.config.ts?raw";
import makeQr from "../scripts/make-qr.mjs?raw";

describe("poster QR code addresses", () => {
  it("each page loads its own app", () => {
    expect(familyHtml).toContain('src="/src/family-main.tsx"');
    expect(clinicHtml).toContain('src="/src/clinic-main.tsx"');
    expect(referHtml).toContain('src="/src/refer-main.tsx"');
  });

  it("all three pages are in the build", () => {
    expect(viteConfig).toMatch(/family:\s*"index\.html"/);
    expect(viteConfig).toMatch(/clinic:\s*"clinic\/index\.html"/);
    expect(viteConfig).toMatch(/refer:\s*"refer\/index\.html"/);
  });

  it("the saved QR codes point at those pages", () => {
    expect(makeQr).toContain('["family-app", base]');
    expect(makeQr).toContain('["clinic-portal", `${base}clinic/?local`]');
    expect(makeQr).toContain('["referrer-page", `${base}refer/`]');
  });

  it("the clinic portal still honours ?local", async () => {
    const hosted = await import("./platform/hosted.ts?raw");
    expect(hosted.default).toMatch(/\[\?&\]local\\b/);
  });
});
