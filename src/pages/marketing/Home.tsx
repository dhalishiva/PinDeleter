import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  Check,
  CloudDownload,
  FlaskConical,
  Gauge,
  Layers,
  LayoutGrid,
  Lock,
  MousePointerClick,
  Plug,
  Repeat,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Users,
  X,
} from 'lucide-react';
import { ButtonLink } from '@/components/Button';
import { Blobs, SectionHeading } from '@/components/ui';
import { FaqList, FloatingPins, ProductMockup } from '@/components/marketing';
import { Seo } from '@/components/Seo';
import { PlanCards } from '@/features/billing/PlanCards';
import { FAQ } from '@/content/faq';
import { FREE_DELETION_LIMIT, PLANS, SITE } from '@/config/site';
import { cn } from '@/lib/cn';

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
};

const STEPS = [
  {
    icon: Plug,
    title: 'Connect Pinterest',
    text: 'Sign in on Pinterest’s own page and approve access. No password ever touches PinDeleter.',
    tone: 'bg-primary-soft text-primary',
  },
  {
    icon: MousePointerClick,
    title: 'Filter & select',
    text: 'Find exactly what to remove by board, date, keyword or engagement — then select in one tap.',
    tone: 'bg-violet-soft text-violet',
  },
  {
    icon: ShieldCheck,
    title: 'Back up & delete',
    text: 'Download your backup, try a dry run, then let our servers delete safely while you get on with your day.',
    tone: 'bg-teal-soft text-teal',
  },
];

const FEATURES = [
  {
    icon: LayoutGrid,
    title: 'Board filter',
    text: 'Pick one board or many. Each chip shows how many pins it holds.',
    tone: 'bg-primary-soft text-primary',
  },
  {
    icon: TrendingDown,
    title: 'Dead-pin filter',
    text: 'Surface pins with zero saves and zero clicks in the last 90 days.',
    tone: 'bg-sunflower-soft text-[#5C4A00]',
  },
  {
    icon: CalendarClock,
    title: 'Date filters',
    text: 'Older than 6 months, 1 year, 3 years — or any custom range.',
    tone: 'bg-sky-soft text-sky',
  },
  {
    icon: Search,
    title: 'Keyword search',
    text: 'Search titles, descriptions, link domains and board names.',
    tone: 'bg-violet-soft text-violet',
  },
  {
    icon: CloudDownload,
    title: 'Automatic backup',
    text: 'JSON and CSV of every selected pin, generated right in your browser.',
    tone: 'bg-teal-soft text-teal',
  },
  {
    icon: FlaskConical,
    title: 'Dry run',
    text: 'See exactly what would be deleted — without touching Pinterest.',
    tone: 'bg-primary-soft text-primary',
  },
  {
    icon: Gauge,
    title: 'Rate-limit safe & resumable',
    text: 'Server-side jobs that pause when Pinterest says so and pick up where they left off.',
    tone: 'bg-sky-soft text-sky',
  },
  {
    icon: Users,
    title: 'Multiple accounts',
    text: 'Manage up to 5 Pinterest accounts with the Agency plan.',
    tone: 'bg-violet-soft text-violet',
  },
];

const AUDIENCES = [
  {
    emoji: '🎨',
    title: 'Creators rebranding',
    text: 'New niche, new look? Clear out off-brand pins and old blog graphics so your profile tells the story you want today.',
    bg: 'bg-tint-pink',
  },
  {
    emoji: '🏢',
    title: 'Businesses & agencies',
    text: 'Retire discontinued products, expired promos and dead links across client accounts — with a CSV report for every job.',
    bg: 'bg-tint-violet',
  },
  {
    emoji: '📌',
    title: 'Long-time pinners',
    text: 'A decade of saves adds up. Tidy up thousands of forgotten pins in minutes instead of a weekend of clicking.',
    bg: 'bg-tint-teal',
  },
];

const COMPARE = [
  ['Delete 1,000 pins', 'Hours of clicking, one by one', 'A few minutes, hands-off'],
  ['Find pins nobody saves', 'Guesswork', 'One “No engagement” filter'],
  ['Backup first', 'Screenshots, if you remember', 'Automatic JSON + CSV'],
  ['Preview the result', 'Not possible', 'Free dry run'],
  ['Rate limits & errors', 'Start again from scratch', 'Auto-pause, auto-resume, retry failed'],
] as const;

export default function Home() {
  return (
    <>
      <Seo
        path="/"
        title="Bulk-delete your Pinterest pins safely"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: SITE.fullName,
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web',
          url: SITE.url,
          description: SITE.description,
          publisher: { '@type': 'Organization', name: SITE.operator, url: SITE.operatorUrl },
          offers: [
            { '@type': 'Offer', name: PLANS.free.name, price: '0', priceCurrency: 'USD' },
            {
              '@type': 'Offer',
              name: PLANS.pass.name,
              price: (PLANS.pass.priceCents / 100).toFixed(2),
              priceCurrency: 'USD',
            },
            {
              '@type': 'Offer',
              name: PLANS.agency.name,
              price: (PLANS.agency.priceCents / 100).toFixed(2),
              priceCurrency: 'USD',
            },
          ],
        }}
      />

      {/* Hero */}
      <section className="relative isolate overflow-hidden pb-16 pt-10 sm:pt-16 lg:pb-24">
        <Blobs />
        <FloatingPins />
        <div className="container-page grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-raised/80 px-3 py-1.5 text-sm font-bold text-primary shadow-card backdrop-blur">
              <Sparkles className="h-4 w-4" aria-hidden /> Spring-clean your Pinterest
            </span>
            <h1 className="mt-5 text-[2.6rem] leading-[1.04] sm:text-6xl">
              Bulk-delete your pins.
              <br />
              <span className="text-gradient">Keep a backup.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted sm:text-xl">
              Filter years of pins by board, date, keyword or engagement, download a backup, and let
              PinDeleter remove them for you — safely, at Pinterest’s pace, with live progress.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/signup" size="lg" icon={<ArrowRight className="h-5 w-5" aria-hidden />}>
                Get started free
              </ButtonLink>
              <ButtonLink to="/how-it-works" size="lg" variant="secondary">
                See how it works
              </ButtonLink>
            </div>
            <p className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold text-ink/70">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-teal" aria-hidden />
                {FREE_DELETION_LIMIT} pins free
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-violet" aria-hidden />
                No Pinterest password
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
                Nothing deleted without your OK
              </span>
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, rotate: 1.5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <ProductMockup />
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-tint-violet py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="How it works"
            title="Three steps to a tidy profile"
            subtitle="No extensions, no scripts, no password sharing."
          />
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.title}
                {...fadeUp}
                transition={{ delay: i * 0.08 }}
                className="card relative p-7 transition hover:-translate-y-1 hover:shadow-lift"
              >
                <span className="absolute right-6 top-5 text-5xl font-black text-ink/[0.06]">{i + 1}</span>
                <span className={cn('inline-flex h-12 w-12 items-center justify-center rounded-2xl', s.tone)}>
                  <s.icon className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="mt-5 text-xl">{s.title}</h3>
                <p className="mt-2 text-muted">{s.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="Features"
            title={
              <>
                Everything you need to <span className="text-gradient">clean up with confidence</span>
              </>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                {...fadeUp}
                transition={{ delay: (i % 4) * 0.05 }}
                className="card p-6 transition hover:-translate-y-1 hover:shadow-lift"
              >
                <span className={cn('inline-flex h-11 w-11 items-center justify-center rounded-2xl', f.tone)}>
                  <f.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg">{f.title}</h3>
                <p className="mt-1.5 text-[0.95rem] text-muted">{f.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="bg-tint-teal py-20">
        <div className="container-page">
          <SectionHeading eyebrow="Who it’s for" title="Made for people who pin a lot" />
          <div className="grid gap-6 md:grid-cols-3">
            {AUDIENCES.map((a, i) => (
              <motion.div
                key={a.title}
                {...fadeUp}
                transition={{ delay: i * 0.08 }}
                className={cn('rounded-4xl border border-line p-7', a.bg, 'bg-raised')}
              >
                <span
                  className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sunset-soft text-3xl"
                  aria-hidden
                >
                  {a.emoji}
                </span>
                <h3 className="mt-5 text-xl">{a.title}</h3>
                <p className="mt-2 text-muted">{a.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-20">
        <div className="container-page max-w-4xl">
          <SectionHeading eyebrow="Manual vs PinDeleter" title="Stop clicking “Delete” a thousand times" />
          <div className="overflow-hidden rounded-4xl border border-line bg-raised shadow-card">
            <table className="w-full text-left text-sm sm:text-base">
              <caption className="sr-only">
                Comparison of deleting pins manually versus with PinDeleter
              </caption>
              <thead>
                <tr className="bg-tint-pink">
                  <th scope="col" className="px-4 py-4 sm:px-6">
                    <span className="sr-only">Task</span>
                  </th>
                  <th scope="col" className="px-4 py-4 font-extrabold text-muted sm:px-6">
                    Manually
                  </th>
                  <th scope="col" className="px-4 py-4 font-extrabold text-primary sm:px-6">
                    With PinDeleter
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {COMPARE.map(([task, manual, ours]) => (
                  <tr key={task}>
                    <th scope="row" className="px-4 py-4 font-bold sm:px-6">
                      {task}
                    </th>
                    <td className="px-4 py-4 text-muted sm:px-6">
                      <span className="inline-flex items-start gap-2">
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
                        {manual}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-semibold sm:px-6">
                      <span className="inline-flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                        {ours}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="bg-tint-sun py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="Pricing"
            title="Simple, one-time pricing"
            subtitle="Every plan includes every feature. No subscriptions, no auto-renewal. Prices in USD."
          />
          <PlanCards />
          <p className="mt-8 text-center text-sm text-muted">
            <Layers className="mr-1 inline h-4 w-4" aria-hidden />
            Compare plans in detail on the{' '}
            <Link to="/pricing" className="font-bold text-violet hover:underline">
              pricing page
            </Link>
            .
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="container-page max-w-3xl">
          <SectionHeading eyebrow="FAQ" title="Questions, answered" />
          <FaqList items={FAQ.slice(0, 9)} />
          <p className="mt-6 text-center text-sm text-muted">
            More answers in the{' '}
            <Link to="/faq" className="font-bold text-violet hover:underline">
              full FAQ
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="pb-24">
        <div className="container-page">
          <div className="relative isolate overflow-hidden rounded-[2.5rem] bg-sunset px-6 py-14 text-center text-white shadow-glow sm:px-12">
            <div
              aria-hidden
              className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/15 blur-2xl"
            />
            <div
              aria-hidden
              className="absolute -bottom-16 right-0 h-64 w-64 rounded-full bg-black/20 blur-3xl"
            />
            <Repeat className="mx-auto h-10 w-10 opacity-90" aria-hidden />
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl text-white sm:text-5xl">
              Ready for a fresh start on Pinterest?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/90">
              Your first {FREE_DELETION_LIMIT} deletions are on us. Backup included.
            </p>
            <ButtonLink
              to="/signup"
              size="lg"
              variant="dark"
              className="mt-8"
              icon={<ArrowRight className="h-5 w-5" aria-hidden />}
            >
              Get started free
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
