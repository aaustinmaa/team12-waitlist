// Writes the two QR codes for the poster to docs/qr/ as SVG (print-sharp at any size) and PNG.
// Run from web/:  node scripts/make-qr.mjs [base-url]
//
// The clinic portal code adds ?local so every visitor who scans it gets a private
// copy of the demo in their own browser, instead of sharing (and changing) the
// hosted demo clinic. The family code opens the hosted app, where families can
// only read.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const qrcode = createRequire(import.meta.url)("qrcode-generator");
const base = (process.argv[2] ?? "https://aaustinmaa.github.io/team12-waitlist/").replace(/\/?$/, "/");
const out = new URL("../../docs/qr/", import.meta.url);
mkdirSync(out, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** Black-and-white PNG, `scale` pixels per module. */
function png(isDark, size, scale) {
  const px = size * scale;
  const rows = [];
  for (let y = 0; y < px; y++) {
    const row = Buffer.alloc(px + 1, 255);
    row[0] = 0;
    for (let x = 0; x < px; x++) if (isDark(Math.floor(y / scale), Math.floor(x / scale))) row[x + 1] = 0;
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(px, 0);
  ihdr.writeUInt32BE(px, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const [name, url] of [["family-app", base], ["clinic-portal", `${base}clinic/?local`]]) {
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  const q = 4;
  const size = n + q * 2;
  const dark = (r, c) => r >= q && c >= q && r < n + q && c < n + q && qr.isDark(r - q, c - q);
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + q} ${r + q}h1v1h-1z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="1024" height="1024" shape-rendering="crispEdges"><title>${url}</title><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>\n`;
  writeFileSync(new URL(`${name}.svg`, out), svg);
  writeFileSync(new URL(`${name}.png`, out), png(dark, size, 24));
  console.log(`docs/qr/${name}.{svg,png} -> ${url}`);
}
