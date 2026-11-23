// Writes the two QR codes for the poster to docs/qr/ as SVG (print-sharp at any size).
// Run from web/:  node scripts/make-qr.mjs [base-url]
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";

const qrcode = createRequire(import.meta.url)("qrcode-generator");
const base = (process.argv[2] ?? "https://aaustinmaa.github.io/team12-waitlist/").replace(/\/?$/, "/");
const out = new URL("../../docs/qr/", import.meta.url);
mkdirSync(out, { recursive: true });

for (const [name, url] of [["family-app", base], ["clinic-portal", `${base}clinic/`]]) {
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  const q = 4;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + q} ${r + q}h1v1h-1z`;
  const size = n + q * 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="1024" height="1024" shape-rendering="crispEdges"><title>${url}</title><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>\n`;
  writeFileSync(new URL(`${name}.svg`, out), svg);
  console.log(`docs/qr/${name}.svg -> ${url}`);
}
