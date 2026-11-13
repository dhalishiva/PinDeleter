import { Link } from 'react-router-dom';
import { SITE } from '@/config/site';
import { LegalLayout } from './LegalLayout';

const ITEMS = [
  [
    'sb-<project>-auth-token',
    'Local storage',
    'Keeps you signed in (Supabase Auth session).',
    'Until you sign out or the session expires',
  ],
  [
    'sb-<project>-auth-token-code-verifier',
    'Local storage',
    'Secures the sign-in redirect (PKCE).',
    'Removed after sign-in',
  ],
  ['pd-theme', 'Local storage', 'Remembers whether you chose light or dark mode.', 'Until you clear it'],
  [
    'pd-active-connection',
    'Local storage',
    'Remembers which Pinterest account you were working on.',
    'Until you clear it',
  ],
  [
    'pd-selection',
    'Session storage',
    'Keeps your current pin selection while you move between pages.',
    'Until you close the tab',
  ],
] as const;

export default function Cookies() {
  return (
    <LegalLayout
      title="Cookie Notice"
      path="/cookies"
      description="PinDeleter uses only essential cookies and local storage. No tracking, no advertising cookies, no consent banner needed."
    >
      <p>
        <strong>
          Short version: PinDeleter uses only essential storage that the Service needs to work. We use no
          analytics, advertising or tracking cookies of any kind. Because we only use strictly necessary
          storage, we don’t need to — and don’t — show a cookie consent banner.
        </strong>
      </p>

      <h2>What we store on your device</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Purpose</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          {ITEMS.map(([name, type, purpose, duration]) => (
            <tr key={name}>
              <td>
                <code>{name}</code>
              </td>
              <td>{type}</td>
              <td>{purpose}</td>
              <td>{duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        All of these are strictly necessary (or store a preference you explicitly set) and are exempt from
        consent requirements under the EU ePrivacy Directive, the UK PECR and similar laws.
      </p>

      <h2>Third parties</h2>
      <ul>
        <li>
          <strong>Google Fonts</strong> serves our typeface (Inter). Your browser requests the font files from
          Google; we do not set cookies for this.
        </li>
        <li>
          <strong>PayPal</strong> loads only on checkout screens. When you open PayPal’s checkout, PayPal may
          set its own cookies for fraud prevention and to process your payment, under PayPal’s cookie policy.
        </li>
        <li>
          <strong>Pinterest</strong> and <strong>Google</strong> sign-in pages are on their own websites and
          use their own cookies.
        </li>
      </ul>

      <h2>Managing storage</h2>
      <p>
        You can clear cookies and site data in your browser settings at any time. If you do, you will be
        signed out and your theme and selection preferences will reset.
      </p>
      <p>
        Questions? See our <Link to="/privacy">Privacy Policy</Link> or email{' '}
        <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.
      </p>
    </LegalLayout>
  );
}
