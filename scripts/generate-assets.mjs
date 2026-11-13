// Generates favicon.svg, favicon.ico, apple-touch-icon.png and og-image.png into /public.
// Usage: npm run assets   (outputs are committed; re-run only after changing the brand)
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = (f) => join(root, 'public', f);

const GRADIENT = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E60023"/><stop offset="0.55" stop-color="#E60023"/><stop offset="1" stop-color="#E60023"/></linearGradient>`;
const MARK_BODY = `
  <rect width="64" height="64" rx="16" fill="url(#g)"/>
  <path d="M47 44c4-1.5 6.5-4.5 7.5-8.5" stroke="#fff" stroke-opacity=".75" stroke-width="3" stroke-linecap="round" fill="none"/>
  <path d="M50.5 48.5c2.2-.6 3.8-1.8 5-3.4" stroke="#fff" stroke-opacity=".5" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  <path d="M30 10.5c-9.1 0-16.5 7.2-16.5 16.1 0 11.4 13.7 24.6 15.4 26.2a1.6 1.6 0 0 0 2.2 0c1.7-1.6 15.4-14.8 15.4-26.2 0-8.9-7.4-16.1-16.5-16.1z" fill="#fff"/>
  <path d="M24.6 21.4l10.8 10.8M35.4 21.4L24.6 32.2" stroke="url(#g)" stroke-width="4.2" stroke-linecap="round"/>`;

const markSvg = (size = 64) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><defs>${GRADIENT}</defs>${MARK_BODY}</svg>`;

const png = (svg, width) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true } })
    .render()
    .asPng();

// favicon.svg
writeFileSync(pub('favicon.svg'), markSvg(64) + '\n');

// apple-touch-icon.png (180px, opaque background as iOS expects)
const touch = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 64 64"><defs>${GRADIENT}</defs><rect width="64" height="64" fill="#E60023"/>${MARK_BODY.replace('rx="16"', 'rx="0"')}</svg>`;
writeFileSync(pub('apple-touch-icon.png'), png(touch, 180));

// PWA icons
writeFileSync(pub('icon-192.png'), png(markSvg(192), 192));
writeFileSync(pub('icon-512.png'), png(markSvg(512), 512));

// favicon.ico containing 16, 32 and 48px PNGs
const sizes = [16, 32, 48];
const images = sizes.map((s) => png(markSvg(s), s));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
const dir = Buffer.alloc(16 * images.length);
let offset = 6 + dir.length;
images.forEach((img, i) => {
  const s = sizes[i];
  dir.writeUInt8(s === 256 ? 0 : s, i * 16);
  dir.writeUInt8(s === 256 ? 0 : s, i * 16 + 1);
  dir.writeUInt8(0, i * 16 + 2);
  dir.writeUInt8(0, i * 16 + 3);
  dir.writeUInt16LE(1, i * 16 + 4);
  dir.writeUInt16LE(32, i * 16 + 6);
  dir.writeUInt32LE(img.length, i * 16 + 8);
  dir.writeUInt32LE(offset, i * 16 + 12);
  offset += img.length;
});
writeFileSync(pub('favicon.ico'), Buffer.concat([header, dir, ...images]));

// og-image.png 1200x630
const tiles = [
  { x: 760, y: 70, w: 170, h: 230, a: '#E60023', b: '#E60023', e: '🍋' },
  { x: 950, y: 40, w: 170, h: 190, a: '#111111', b: '#B5B5B5', e: '✈️' },
  { x: 760, y: 320, w: 170, h: 200, a: '#767676', b: '#E60023', e: '🪴' },
  { x: 950, y: 250, w: 170, h: 250, a: '#E60023', b: '#E60023', e: '🧁' },
];
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>${GRADIENT}
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7F7F7"/><stop offset="1" stop-color="#EFEFEF"/></linearGradient>
    ${tiles.map((t, i) => `<linearGradient id="t${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.a}"/><stop offset="1" stop-color="${t.b}"/></linearGradient>`).join('')}
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="120" cy="560" r="220" fill="#E60023" opacity=".18"/>
  <circle cx="1120" cy="80" r="200" fill="#E60023" opacity=".14"/>
  <circle cx="700" cy="620" r="160" fill="#767676" opacity=".12"/>
  ${tiles
    .map(
      (
        t,
        i,
      ) => `<g opacity="${i === 1 || i === 3 ? 0.55 : 1}"><rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" rx="24" fill="url(#t${i})"/>
      <circle cx="${t.x + t.w - 34}" cy="${t.y + 34}" r="22" fill="#fff" opacity=".22"/>
      ${i === 1 || i === 3 ? `<path d="M${t.x + t.w / 2 - 22} ${t.y + t.h / 2 - 22}l44 44M${t.x + t.w / 2 + 22} ${t.y + t.h / 2 - 22}l-44 44" stroke="#fff" stroke-width="12" stroke-linecap="round"/>` : `<circle cx="${t.x + 30}" cy="${t.y + 30}" r="16" fill="#fff"/><path d="M${t.x + 22} ${t.y + 30}l6 6 11-12" stroke="#E60023" stroke-width="4" fill="none" stroke-linecap="round"/>`}</g>`,
    )
    .join('')}
  <g transform="translate(80 92) scale(1.5)">${MARK_BODY}</g>
  <text x="190" y="152" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="800" font-size="56" fill="#111111" letter-spacing="-2">PinDeleter</text>
  <text x="192" y="184" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="500" font-size="22" fill="#767676">by Kriosity</text>
  <text x="80" y="300" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="800" font-size="64" fill="#111111" letter-spacing="-2.5">Bulk-delete your pins.</text>
  <text x="80" y="378" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="800" font-size="64" fill="url(#g)" letter-spacing="-2.5">Keep a backup.</text>
  <text x="80" y="450" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="500" font-size="26" fill="#767676">Filters · automatic backup · dry run · rate-limit safe</text>
  <rect x="80" y="500" width="300" height="64" rx="32" fill="url(#g)"/>
  <text x="230" y="541" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="800" font-size="24" fill="#fff">50 pins free</text>
  <text x="410" y="541" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="600" font-size="20" fill="#767676">pindeleter.kriosity.in</text>
</svg>`;
writeFileSync(pub('og-image.png'), png(og, 1200));
console.log('Assets written to /public');
