// Resend transactional email.
import { env, optionalEnv } from './env.ts';
import { errorFields, log } from './log.ts';

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export async function sendEmail(msg: EmailMessage, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const apiKey = optionalEnv('RESEND_API_KEY');
  if (!apiKey) {
    log.warn('email_skipped_no_api_key', { subject: msg.subject });
    return false;
  }
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env('EMAIL_FROM', 'PinDeleter <noreply@kriosity.in>'),
        to: Array.isArray(msg.to) ? msg.to : [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
        ...(msg.tags ? { tags: msg.tags } : {}),
      }),
    });
    if (!res.ok) {
      log.error('email_send_failed', { status: res.status, body: (await res.text()).slice(0, 300) });
      return false;
    }
    return true;
  } catch (err) {
    log.error('email_send_failed', errorFields(err));
    return false;
  }
}
