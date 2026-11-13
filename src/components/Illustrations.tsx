// Original SVG illustrations drawn in code, using the brand palette.
interface P {
  className?: string;
}

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#E60023" />
        <stop offset=".55" stopColor="#E60023" />
        <stop offset="1" stopColor="#E60023" />
      </linearGradient>
    </defs>
  );
}

/** Empty state: a tidy stack of pin cards with sparkles. */
export function EmptyPinsIllustration({ className }: P) {
  return (
    <svg viewBox="0 0 200 160" className={className} aria-hidden>
      <Defs id="ill-empty" />
      <ellipse cx="100" cy="146" rx="70" ry="8" fill="#111111" opacity=".06" />
      <rect x="40" y="40" width="56" height="78" rx="12" fill="#EFEFEF" transform="rotate(-10 68 79)" />
      <rect x="104" y="36" width="56" height="86" rx="12" fill="#DAFFF6" transform="rotate(9 132 79)" />
      <rect x="70" y="26" width="60" height="96" rx="14" fill="url(#ill-empty)" />
      <circle cx="100" cy="62" r="14" fill="#fff" opacity=".9" />
      <rect x="82" y="88" width="36" height="6" rx="3" fill="#fff" opacity=".85" />
      <rect x="88" y="100" width="24" height="6" rx="3" fill="#fff" opacity=".6" />
      <path d="M160 30l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#E0A500" />
      <path d="M36 28l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#111111" />
      <circle cx="170" cy="100" r="4" fill="#008753" />
      <circle cx="28" cy="96" r="3" fill="#E60023" />
    </svg>
  );
}

/** Connect state: two linked bubbles. */
export function ConnectIllustration({ className }: P) {
  return (
    <svg viewBox="0 0 220 150" className={className} aria-hidden>
      <Defs id="ill-connect" />
      <ellipse cx="110" cy="138" rx="80" ry="8" fill="#111111" opacity=".06" />
      <rect x="20" y="30" width="78" height="78" rx="22" fill="url(#ill-connect)" />
      <path
        d="M59 50c-9 0-16 7-16 15.6 0 10.8 13.3 23.6 14.9 25.2a1.6 1.6 0 0 0 2.2 0C61.7 89.2 75 76.4 75 65.6 75 57 68 50 59 50z"
        fill="#fff"
      />
      <rect x="122" y="30" width="78" height="78" rx="22" fill="#EFEFEF" />
      <circle cx="161" cy="60" r="13" fill="#111111" />
      <rect x="140" y="80" width="42" height="12" rx="6" fill="#111111" opacity=".5" />
      <path
        d="M98 62h24M98 76h24"
        stroke="#008753"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="2 9"
      />
      <circle cx="110" cy="69" r="10" fill="#008753" />
      <path
        d="M105 69l3.5 3.5L115 66"
        stroke="#fff"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 404: a lost pin floating among clouds. */
export function NotFoundIllustration({ className }: P) {
  return (
    <svg viewBox="0 0 240 180" className={className} aria-hidden>
      <Defs id="ill-404" />
      <ellipse cx="60" cy="130" rx="40" ry="16" fill="#EFEFEF" />
      <ellipse cx="190" cy="120" rx="36" ry="14" fill="#E1F0FF" />
      <ellipse cx="120" cy="164" rx="50" ry="7" fill="#111111" opacity=".06" />
      <g transform="rotate(-14 120 80)">
        <path
          d="M120 22c-20 0-36 15.6-36 35 0 24.6 30 53.4 33.6 56.8a3.4 3.4 0 0 0 4.8 0C126 110.4 156 81.6 156 57c0-19.4-16-35-36-35z"
          fill="url(#ill-404)"
        />
        <circle cx="120" cy="56" r="14" fill="#fff" />
        <text
          x="120"
          y="62"
          textAnchor="middle"
          fontSize="16"
          fontWeight="900"
          fill="#E60023"
          fontFamily="Inter, sans-serif"
        >
          ?
        </text>
      </g>
      <path d="M40 40l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#E0A500" />
      <path d="M200 50l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#008753" />
    </svg>
  );
}

/** Success: trophy-like burst with a check. */
export function SuccessIllustration({ className }: P) {
  return (
    <svg viewBox="0 0 200 170" className={className} aria-hidden>
      <Defs id="ill-ok" />
      <ellipse cx="100" cy="156" rx="60" ry="7" fill="#111111" opacity=".06" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
        <rect
          key={a}
          x="97"
          y="8"
          width="6"
          height="22"
          rx="3"
          fill={['#E60023', '#111111', '#008753', '#E0A500'][i % 4]}
          transform={`rotate(${a} 100 80)`}
        />
      ))}
      <circle cx="100" cy="80" r="46" fill="url(#ill-ok)" />
      <path
        d="M78 81l15 15 30-31"
        stroke="#fff"
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** About: a friendly workspace — laptop with a pin grid and a coffee cup. */
export function AboutIllustration({ className }: P) {
  return (
    <svg viewBox="0 0 280 200" className={className} aria-hidden>
      <Defs id="ill-about" />
      <ellipse cx="140" cy="186" rx="110" ry="9" fill="#111111" opacity=".06" />
      <rect x="50" y="30" width="180" height="120" rx="16" fill="#111111" />
      <rect x="60" y="40" width="160" height="100" rx="10" fill="#FFFFFF" />
      <rect x="70" y="50" width="34" height="46" rx="6" fill="url(#ill-about)" />
      <rect x="110" y="50" width="34" height="32" rx="6" fill="#111111" opacity=".8" />
      <rect x="150" y="50" width="34" height="52" rx="6" fill="#008753" opacity=".8" />
      <rect x="190" y="50" width="22" height="38" rx="6" fill="#0074E8" opacity=".7" />
      <rect x="70" y="102" width="34" height="30" rx="6" fill="#E0A500" opacity=".85" />
      <rect x="110" y="88" width="34" height="44" rx="6" fill="#E60023" opacity=".75" />
      <rect x="150" y="108" width="34" height="24" rx="6" fill="#E60023" opacity=".7" />
      <path d="M30 150h220l-12 18H42z" fill="#333333" />
      <rect x="236" y="120" width="30" height="34" rx="8" fill="#FFE2EB" />
      <path d="M266 130c8 0 8 14 0 14" stroke="#FFE2EB" strokeWidth="5" fill="none" />
      <path
        d="M244 110c0-6 6-6 6-12M254 110c0-6 6-6 6-12"
        stroke="#767676"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity=".5"
      />
    </svg>
  );
}

/** Generic error face. */
export function OopsIllustration({ className }: P) {
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden>
      <Defs id="ill-oops" />
      <circle cx="80" cy="76" r="56" fill="url(#ill-oops)" />
      <circle cx="62" cy="66" r="7" fill="#fff" />
      <circle cx="98" cy="66" r="7" fill="#fff" />
      <path d="M60 100c12-10 28-10 40 0" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" />
      <ellipse cx="80" cy="148" rx="40" ry="6" fill="#111111" opacity=".06" />
    </svg>
  );
}
