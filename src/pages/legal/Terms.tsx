import { Link } from 'react-router-dom';
import { FREE_DELETION_LIMIT, fullAddress, SITE } from '@/config/site';
import { LegalLayout } from './LegalLayout';

export default function Terms() {
  const email = SITE.supportEmail;
  return (
    <LegalLayout
      title="Terms of Service"
      path="/terms"
      description="The terms that govern your use of PinDeleter by Kriosity."
    >
      <p>
        These Terms of Service (“<strong>Terms</strong>”) are a contract between you and {SITE.operator}, a
        sole proprietorship owned by {SITE.proprietor} at {fullAddress()} (“<strong>Kriosity</strong>”, “
        <strong>we</strong>”, “<strong>us</strong>”), and govern your use of PinDeleter at {SITE.url} (the “
        <strong>Service</strong>”). By creating an account or using the Service you agree to these Terms and
        to our <Link to="/privacy">Privacy Policy</Link>. If you do not agree, do not use the Service.
      </p>

      <h2>1. What the Service does</h2>
      <p>
        PinDeleter lets you connect Pinterest accounts through Pinterest’s official API, view and filter your
        boards and pins, download backups, run dry runs and run server-side jobs that delete the pins you
        select. PinDeleter is an independent product and is not affiliated with, endorsed by or sponsored by
        Pinterest, Inc.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 16 years old to use the Service. If you are under 18 (or the age of majority
        where you live), you may use it only with the consent and supervision of a parent or legal guardian
        who agrees to these Terms. You must also be allowed to use Pinterest under Pinterest’s terms. If you
        use the Service for a business, you confirm you are authorised to bind that business.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>
          Provide an accurate email address and keep access to it secure. You are responsible for activity
          under your account.
        </li>
        <li>
          Tell us promptly at <a href={`mailto:${email}`}>{email}</a> if you suspect unauthorised use.
        </li>
        <li>One person or business per account. Do not share accounts to get around plan limits.</li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>
        You may connect and act only on Pinterest accounts that you own or that you are expressly authorised
        to manage. You must not:
      </p>
      <ul>
        <li>use the Service on someone else’s Pinterest account without their permission;</li>
        <li>break the law, Pinterest’s Terms of Service, Developer Guidelines or Community Guidelines;</li>
        <li>
          attempt to bypass rate limits, plan limits, payment or security controls, or access other users’
          data;
        </li>
        <li>
          reverse engineer, scrape, overload or disrupt the Service, or use automated means other than the
          interface we provide;
        </li>
        <li>
          resell or provide the Service to third parties except as part of managing accounts you are
          authorised to manage (Agency plan).
        </li>
      </ul>

      <h2>5. Deletion is irreversible and your responsibility</h2>
      <p>
        <strong>
          Deleting a pin on Pinterest is permanent. Neither we nor Pinterest can restore deleted pins.
        </strong>{' '}
        You decide which pins to delete. Before every real deletion job we ask you to download a backup and
        type DELETE to confirm, and we offer a dry run. You are responsible for reviewing your selection,
        keeping your backup, and making sure you have the right to delete the pins. A backup contains pin
        metadata (such as titles, links, boards and image URLs) — it cannot be used to re-create pins
        automatically.
      </p>

      <h2>6. Plans, prices and payment</h2>
      <ul>
        <li>
          <strong>Free:</strong> {FREE_DELETION_LIMIT} successful deletions in total (lifetime), on one
          Pinterest account.
        </li>
        <li>
          <strong>Cleanup Pass</strong> and <strong>Agency</strong>: one-time payments in US dollars giving
          unlimited deletions for 30 days on 1 or up to 5 Pinterest accounts respectively. Buying again while
          a pass is active extends it by 30 days.
        </li>
        <li>
          Plans do not renew automatically and are not subscriptions. Prices are shown on the{' '}
          <Link to="/pricing">Pricing page</Link> and may change for future purchases.
        </li>
        <li>
          Payments are processed by PayPal under PayPal’s terms. PayPal may show the price in your local
          currency; currency conversion and any fees are set by PayPal or your bank. Prices exclude any taxes
          or fees your bank or PayPal may charge you.
        </li>
        <li>
          Only successful deletions count toward the free limit. Failed or skipped deletions are never counted
          or charged.
        </li>
        <li>
          Refunds are handled under our <Link to="/refund-policy">Refund &amp; Cancellation Policy</Link>.
        </li>
      </ul>

      <h2>7. Pinterest API availability</h2>
      <p>
        The Service depends on Pinterest’s API, which Pinterest controls. Pinterest may rate-limit, change,
        restrict or withdraw API access at any time. Jobs may therefore be slowed, paused or stopped. We will
        resume jobs automatically where possible, but we cannot guarantee any particular speed or that every
        pin can be deleted. If Pinterest permanently withdraws our access, we will refund paid plans on a
        pro-rata basis for the unused period.
      </p>

      <h2>8. Our intellectual property</h2>
      <p>
        The Service, its software, design and brand are owned by Kriosity. We grant you a limited,
        non-exclusive, non-transferable licence to use the Service under these Terms. Your Pinterest content
        remains yours; you grant us only the permissions needed to process it to provide the Service.
      </p>

      <h2>9. No warranty</h2>
      <p>
        To the extent permitted by law, the Service is provided “as is” and “as available”, without warranties
        of any kind, express or implied, including fitness for a particular purpose, merchantability and
        non-infringement. We do not warrant that the Service will be uninterrupted, error-free or that it will
        delete every selected pin.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the extent permitted by law, Kriosity will not be liable for any indirect, incidental, special,
        consequential or punitive damages, or for loss of data, content, profits, followers or goodwill,
        including loss of pins you chose to delete. Our total liability for any claim relating to the Service
        is limited to the greater of the amount you paid us in the 12 months before the claim or US$20.
        Nothing in these Terms limits liability that cannot be limited by law, such as liability for fraud,
        gross negligence or wilful misconduct, or for death or personal injury caused by negligence.
      </p>

      <h2>11. Indemnity</h2>
      <p>
        You agree to indemnify Kriosity against claims arising from your breach of these Terms or your use of
        the Service on accounts you were not authorised to manage, to the extent permitted by law.
      </p>

      <h2>12. Suspension and termination</h2>
      <p>
        You may stop using the Service and delete your account at any time from Settings. We may suspend or
        terminate your access if you breach these Terms, if required by law, or if Pinterest requires it. If
        we terminate without cause, we will refund any unused part of a paid plan. Sections that by their
        nature should survive termination (including 5, 9, 10, 11 and 13) survive.
      </p>

      <h2>13. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of India. Subject to the next sentence, the {SITE.jurisdiction}{' '}
        have exclusive jurisdiction. If you are a consumer, nothing in these Terms takes away the mandatory
        protections of the consumer laws of the country where you live, and you may also bring proceedings in
        the courts of your country of residence. Please contact us first — most issues can be solved by email.
      </p>

      <h2>14. Changes</h2>
      <p>
        We may update these Terms. For material changes we will give at least 14 days’ notice by email or in
        the app. Continuing to use the Service after changes take effect means you accept them. Changes do not
        affect plans already paid for.
      </p>

      <h2>15. Contact</h2>
      <p>
        {SITE.operator} (proprietor: {SITE.proprietor}), {fullAddress()}. Email:{' '}
        <a href={`mailto:${email}`}>{email}</a>.
      </p>
      <p>{SITE.disclaimer}</p>
    </LegalLayout>
  );
}
