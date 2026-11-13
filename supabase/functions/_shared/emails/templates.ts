// Transactional email templates. Each returns { subject, html, text }.
import { BUSINESS } from '../business.ts';
import { formatUsd } from '../plans.ts';
import { button, esc, layout, table } from './layout.ts';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return (
    new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) +
    ' UTC'
  );
}

function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`;
}

export function jobCompletedEmail(p: {
  siteUrl: string;
  jobId: string;
  username: string;
  deleted: number;
  failed: number;
  skipped: number;
  durationMs: number;
}): RenderedEmail {
  const jobUrl = `${p.siteUrl}/app/jobs/${p.jobId}`;
  const reportUrl = `${p.siteUrl}/app/jobs?report=${p.jobId}`;
  const html = layout({
    preheader: `${p.deleted} pins deleted from @${p.username}.`,
    heading: 'Your cleanup is done 🎉',
    bodyHtml: `<p>The deletion job for <strong>@${esc(p.username)}</strong> has finished.</p>
${table([
  ['Deleted', String(p.deleted)],
  ['Failed', String(p.failed)],
  ['Skipped', String(p.skipped)],
  ['Duration', fmtDuration(p.durationMs)],
])}
${p.failed > 0 ? `<p>Some pins could not be deleted. You can retry just the failed ones from the job page — failed deletions are never counted against your plan.</p>` : ''}
<p style="margin:22px 0">${button(jobUrl, 'View job')}</p>
<p style="font-size:13px;color:#767676">Need a record? <a href="${esc(reportUrl)}" style="color:#111111">Download the full report (CSV)</a>.</p>`,
  });
  const text = `Your cleanup is done.\n\n@${p.username}: ${p.deleted} deleted, ${p.failed} failed, ${p.skipped} skipped (${fmtDuration(p.durationMs)}).\n\nView job: ${jobUrl}\nReport: ${reportUrl}\n\n${BUSINESS.disclaimer}`;
  return { subject: `Done: ${p.deleted} pins deleted from @${p.username}`, html, text };
}

export function jobFailedEmail(p: {
  siteUrl: string;
  jobId: string;
  username: string;
  reason: string;
  needsReauth: boolean;
}): RenderedEmail {
  const actionUrl = p.needsReauth ? `${p.siteUrl}/app/accounts` : `${p.siteUrl}/app/jobs/${p.jobId}`;
  const html = layout({
    preheader: p.needsReauth ? 'Please reconnect your Pinterest account.' : 'Your deletion job stopped.',
    heading: p.needsReauth ? 'Please reconnect Pinterest' : 'Your deletion job stopped',
    bodyHtml: `<p>We had to stop the deletion job for <strong>@${esc(p.username)}</strong>.</p>
<p style="background:#FFFD92;border-radius:12px;padding:12px 14px">${esc(p.reason)}</p>
${p.needsReauth ? '<p>Pinterest no longer accepts our access for this account. This happens when access is removed on Pinterest or expires. Reconnect the account and start the job again — pins that were already deleted stay deleted, and nothing is charged for pins that were not.</p>' : '<p>Nothing was charged for pins that were not deleted. You can start a new job at any time.</p>'}
<p style="margin:22px 0">${button(actionUrl, p.needsReauth ? 'Reconnect account' : 'View job')}</p>`,
  });
  const text = `We had to stop the deletion job for @${p.username}.\n\n${p.reason}\n\n${actionUrl}\n\n${BUSINESS.disclaimer}`;
  return {
    subject: p.needsReauth ? `Action needed: reconnect @${p.username}` : `Your PinDeleter job stopped`,
    html,
    text,
  };
}

export function paymentReceiptEmail(p: {
  siteUrl: string;
  planName: string;
  amountCents: number;
  captureId: string;
  orderId: string;
  paidAt: string;
  expiresAt: string;
  payerEmail: string | null;
  receiptNo: string;
}): RenderedEmail {
  const rows: [string, string][] = [
    ['Receipt / invoice no.', p.receiptNo],
    ['Plan', `${p.planName} (30 days, one-time, no auto-renewal)`],
    ['Amount paid', `${formatUsd(p.amountCents)} USD`],
    ['Date', fmtDate(p.paidAt)],
    ['Access valid until', fmtDate(p.expiresAt)],
    ['PayPal capture ID', p.captureId],
    ['PayPal order ID', p.orderId],
  ];
  if (p.payerEmail) rows.push(['Billed to', p.payerEmail]);
  const html = layout({
    preheader: `Receipt for ${p.planName} — ${formatUsd(p.amountCents)} USD`,
    heading: 'Thanks — your payment is confirmed',
    bodyHtml: `<p>This email is your receipt and invoice for your PinDeleter purchase.</p>
${table(rows)}
<p style="font-size:13px;color:#767676">Seller: ${esc(BUSINESS.operator)} (proprietor: ${esc(BUSINESS.proprietor)}), ${esc(BUSINESS.address)}. Export of services; price charged in USD. PayPal may have shown the amount converted into your local currency.</p>
<p style="font-size:13px;color:#767676">Refunds: if no paid-tier deletion job has run, you can request a full refund within 7 days. See ${esc(p.siteUrl)}/refund-policy.</p>
<p style="margin:22px 0">${button(`${p.siteUrl}/app/billing`, 'Go to billing')}</p>`,
  });
  const text = `Thanks — your payment is confirmed.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nSeller: ${BUSINESS.operator} (proprietor: ${BUSINESS.proprietor}), ${BUSINESS.address}\nRefund policy: ${p.siteUrl}/refund-policy\n`;
  return { subject: `Your PinDeleter receipt — ${p.planName}`, html, text };
}

export function contactAdminEmail(p: {
  name: string;
  email: string;
  topic: string;
  message: string;
}): RenderedEmail {
  const html = layout({
    preheader: `New contact message from ${p.name}`,
    heading: `New message: ${p.topic}`,
    bodyHtml: `${table([
      ['From', `${p.name} <${p.email}>`],
      ['Topic', p.topic],
    ])}<p style="white-space:pre-wrap;background:#EFEFEF;border-radius:12px;padding:14px">${esc(p.message)}</p><p style="font-size:13px;color:#767676">Reply to this email to answer the sender directly.</p>`,
  });
  return {
    subject: `[PinDeleter contact] ${p.topic} — ${p.name}`,
    html,
    text: `From: ${p.name} <${p.email}>\nTopic: ${p.topic}\n\n${p.message}`,
  };
}

export function contactAckEmail(p: { name: string; topic: string; message: string }): RenderedEmail {
  const html = layout({
    preheader: 'We received your message and will reply soon.',
    heading: `Thanks, ${p.name}!`,
    bodyHtml: `<p>We received your message about <strong>${esc(p.topic)}</strong> and will reply within 2 business days, usually sooner.</p>
<p style="white-space:pre-wrap;background:#EFEFEF;border-radius:12px;padding:14px;color:#767676">${esc(p.message)}</p>
<p>If you need to add anything, just reply to ${BUSINESS.supportEmail}.</p>`,
  });
  return {
    subject: 'We received your message — PinDeleter',
    html,
    text: `Thanks, ${p.name}! We received your message about "${p.topic}" and will reply within 2 business days.\n\n${BUSINESS.supportEmail}`,
  };
}
