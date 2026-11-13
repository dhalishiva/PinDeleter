// Branded, dependency-free HTML email layout.
import { BUSINESS } from '../business.ts';

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function button(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:#E60023;background-image:linear-gradient(120deg,#E60023,#E60023);color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;font-size:15px">${esc(label)}</a>`;
}

export function table(rows: [string, string][]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#767676;font-size:14px;border-bottom:1px solid #E9E9E9">${esc(k)}</td><td style="padding:8px 0;color:#111111;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #E9E9E9">${esc(v)}</td></tr>`,
    )
    .join('')}</table>`;
}

const LOGO = `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:36px;height:36px;border-radius:10px;background:#E60023;background-image:linear-gradient(135deg,#E60023,#E60023 55%,#E60023);text-align:center;vertical-align:middle;color:#fff;font-weight:900;font-size:18px">&#10005;</td><td style="padding-left:10px;font-weight:800;font-size:18px;color:#111111;letter-spacing:-0.02em">PinDeleter <span style="font-weight:500;font-size:12px;color:#767676">by Kriosity</span></td></tr></table>`;

/** bodyHtml must already be escaped where it contains user data. */
export function layout(opts: { preheader: string; heading: string; bodyHtml: string }): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#F7F7F7;font-family:Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111111">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:8px 4px 16px">${LOGO}</td></tr>
<tr><td style="background:#ffffff;border-radius:20px;padding:28px;border:1px solid #E9E9E9">
<div style="height:6px;border-radius:999px;background:#E60023;background-image:linear-gradient(90deg,#E60023,#E60023,#E60023);margin-bottom:20px"></div>
<h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.02em">${esc(opts.heading)}</h1>
<div style="font-size:15px;line-height:1.6;color:#111111">${opts.bodyHtml}</div>
</td></tr>
<tr><td style="padding:18px 8px;color:#767676;font-size:12px;line-height:1.6">
${esc(BUSINESS.operator)} (proprietor: ${esc(BUSINESS.proprietor)}) · ${esc(BUSINESS.address)}<br>
Questions? <a href="mailto:${BUSINESS.supportEmail}" style="color:#111111">${BUSINESS.supportEmail}</a><br><br>
${esc(BUSINESS.disclaimer)}
</td></tr></table></td></tr></table></body></html>`;
}
