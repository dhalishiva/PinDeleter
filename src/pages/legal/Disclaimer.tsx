import { Link } from 'react-router-dom';
import { SITE } from '@/config/site';
import { LegalLayout } from './LegalLayout';

export default function Disclaimer() {
  return (
    <LegalLayout
      title="Disclaimer"
      path="/disclaimer"
      description="PinDeleter is an independent product and is not affiliated with Pinterest, Inc."
    >
      <h2>Independent product</h2>
      <p>
        <strong>{SITE.disclaimer}</strong>
      </p>
      <p>
        PinDeleter is built and operated by {SITE.operator}. It uses Pinterest’s publicly available API under
        Pinterest’s developer terms, in the same way as other third-party apps. Pinterest has not reviewed,
        approved or endorsed this website, its content or its pricing.
      </p>

      <h2>Trademarks</h2>
      <p>
        “Pinterest” and related names and logos are trademarks of Pinterest, Inc. They are used on this site
        only to describe the service that PinDeleter works with (nominative use). PinDeleter does not use
        Pinterest’s logo. Any similarity in colours or interface style does not indicate any connection with,
        or endorsement by, Pinterest, Inc. All other trademarks belong to their respective owners.
      </p>

      <h2>No professional advice</h2>
      <p>
        Content on this website (for example guides on cleaning up your profile) is general information and
        not marketing, legal or business advice. Decide what to delete based on your own judgement.
      </p>

      <h2>Irreversible actions</h2>
      <p>
        Deleting pins on Pinterest cannot be undone. Always download and keep your backup before running a
        deletion job. See our <Link to="/terms">Terms of Service</Link> for details.
      </p>

      <h2>Contact</h2>
      <p>
        If you believe something on this site infringes your rights, email{' '}
        <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.
      </p>
    </LegalLayout>
  );
}
