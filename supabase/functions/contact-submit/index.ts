// Public contact form: honeypot, validation, rate limit, store, notify admin, acknowledge sender.
import { clientIp } from '../_shared/auth.ts';
import { z } from '../_shared/deps.ts';
import { env } from '../_shared/env.ts';
import { contactAckEmail, contactAdminEmail } from '../_shared/emails/templates.ts';
import { handler, json, parseJson } from '../_shared/http.ts';
import { enforceRateLimit, hashIdentifier } from '../_shared/ratelimit.ts';
import { sendEmail } from '../_shared/resend.ts';
import { adminClient } from '../_shared/supabase.ts';

const TOPICS = [
  'General question',
  'Billing & refunds',
  'Technical problem',
  'Privacy request',
  'Partnership',
  'Other',
] as const;

const Body = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  topic: z.enum(TOPICS),
  message: z.string().trim().min(10).max(5000),
  website: z.string().max(200).optional(), // honeypot
});

Deno.serve(
  handler({ name: 'contact-submit', methods: ['POST'] }, async (req) => {
    const body = await parseJson(req, Body);
    if (body.website) return json(req, { ok: true }); // bots fill hidden fields; pretend success

    const ipHash = await hashIdentifier(clientIp(req));
    await enforceRateLimit('contact', ipHash, 5, 3600);

    const name = body.name.replace(/[\r\n]+/g, ' ');
    const { error } = await adminClient()
      .from('contact_messages')
      .insert({
        name,
        email: body.email,
        topic: body.topic,
        message: body.message,
        ip_hash: ipHash,
        user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
      });
    if (error) throw new Error(error.message);

    const admin = contactAdminEmail({ name, email: body.email, topic: body.topic, message: body.message });
    await sendEmail({ to: env('ADMIN_EMAIL', 'support@kriosity.in'), replyTo: body.email, ...admin });
    const ack = contactAckEmail({ name, topic: body.topic, message: body.message });
    await sendEmail({ to: body.email, replyTo: env('ADMIN_EMAIL', 'support@kriosity.in'), ...ack });
    return json(req, { ok: true });
  }),
);
