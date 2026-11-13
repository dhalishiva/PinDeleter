import { Link } from 'react-router-dom';
import { formatPrice, PLANS, SITE } from '@/config/site';
import { LegalLayout } from './LegalLayout';

export default function Refund() {
  const email = SITE.supportEmail;
  return (
    <LegalLayout
      title="Refund & Cancellation Policy"
      path="/refund-policy"
      description="Refunds and cancellations for PinDeleter’s one-time Cleanup Pass and Agency plans."
    >
      <h2>1. One-time passes, no subscriptions</h2>
      <p>
        PinDeleter’s paid plans — the {PLANS.pass.name} ({formatPrice(PLANS.pass.priceCents)} USD) and{' '}
        {PLANS.agency.name} ({formatPrice(PLANS.agency.priceCents)} USD) — are one-time payments that unlock
        unlimited deletions for 30 days. They never renew automatically, so there is nothing to cancel: your
        plan simply ends after 30 days and you return to the free plan.
      </p>

      <h2>2. 7-day refund</h2>
      <p>
        You can get a <strong>full refund</strong> if both of these are true:
      </p>
      <ul>
        <li>
          you ask within <strong>7 days</strong> of the payment, and
        </li>
        <li>
          <strong>no paid-tier deletion job has run</strong> since the payment — meaning no real (non-dry-run)
          job deleted pins beyond what the free plan allows while the pass was active.
        </li>
      </ul>
      <p>
        Dry runs, syncing, filtering, downloading backups and connecting accounts do not affect your
        eligibility. If you bought a pass by mistake twice, the duplicate is always refundable within 7 days.
      </p>

      <h2>3. Failed deletions are never charged</h2>
      <p>
        Only pins that are actually deleted count towards the free limit. Pins that fail, are skipped, are
        cancelled or were already gone are never counted. If something on our side prevented a paid job from
        working (for example an outage or Pinterest withdrawing our API access), contact us — we will refund
        or extend your pass even outside the 7-day window.
      </p>

      <h2>4. How to request a refund</h2>
      <ol>
        <li>
          Email <a href={`mailto:${email}`}>{email}</a> from the email address of your PinDeleter account, or
          use the <Link to="/contact">contact form</Link> with the topic “Billing &amp; refunds”.
        </li>
        <li>
          Include your PayPal order ID or capture ID (shown on the Billing page and in your receipt email).
        </li>
        <li>We will confirm eligibility, usually within 2 business days.</li>
      </ol>

      <h2>5. Processing time</h2>
      <p>
        Approved refunds are issued through PayPal to the original payment method in US dollars. PayPal and
        banks normally take <strong>5–7 business days</strong> to show the refund. Because the amount is
        converted by PayPal or your bank, the amount in your local currency may differ slightly from what you
        paid due to exchange-rate changes. When a refund is issued, the 30 days added by that payment are
        removed from your plan.
      </p>

      <h2>6. Chargebacks</h2>
      <p>
        Please contact us before opening a dispute — we are happy to help. If a payment is reversed through a
        dispute or chargeback, the corresponding plan time is removed.
      </p>

      <h2>7. Your statutory rights</h2>
      <p>
        This policy does not limit any refund or withdrawal rights you have under the mandatory consumer law
        of your country. By starting a paid deletion job you request that the digital service begins
        immediately, which may affect statutory withdrawal rights where the law allows.
      </p>

      <h2>8. Contact</h2>
      <p>
        {SITE.operator} · <a href={`mailto:${email}`}>{email}</a>
      </p>
    </LegalLayout>
  );
}
