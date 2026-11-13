import {
  CheckCircle2,
  CloudDownload,
  FlaskConical,
  Keyboard,
  Mail,
  Plug,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { Seo } from '@/components/Seo';
import { ButtonLink } from '@/components/Button';
import { PinTile, SAMPLE_PINS } from '@/components/marketing';
import { LogoMark } from '@/components/Logo';
import { cn } from '@/lib/cn';
import { PageHero } from './PageHero';

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('card overflow-hidden rounded-[26px] shadow-lift', className)} aria-hidden>
      <div className="flex items-center gap-1.5 border-b border-line bg-tint-pink px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        <LogoMark size={18} className="ml-auto" />
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

const STEPS = [
  {
    icon: Plug,
    title: '1. Connect your Pinterest account',
    text: 'Click “Connect Pinterest”. You’re sent to Pinterest’s own sign-in page to approve read access to your boards and pins and permission to delete pins. We never see your password, and you can disconnect any time.',
    mock: (
      <Frame>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex items-center gap-3">
            <LogoMark size={44} />
            <span className="text-2xl text-muted">⇄</span>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-soft text-xl">
              📌
            </span>
          </div>
          <p className="font-extrabold">Allow PinDeleter to access your account?</p>
          <div className="flex flex-wrap justify-center gap-2 text-xs font-bold">
            {['Read boards', 'Read pins', 'Delete pins', 'Read profile'].map((s) => (
              <span key={s} className="rounded-full bg-teal-soft px-2.5 py-1 text-teal">
                {s}
              </span>
            ))}
          </div>
          <span className="rounded-full bg-sunset px-5 py-2 text-sm font-bold text-white">Allow</span>
        </div>
      </Frame>
    ),
  },
  {
    icon: RefreshCw,
    title: '2. We sync your boards and pins',
    text: 'PinDeleter fetches your boards and pins page by page and shows live progress. Large accounts keep syncing in the background, so you can leave and come back.',
    mock: (
      <Frame>
        <p className="text-sm font-bold">Syncing @your_account…</p>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full w-2/3 rounded-full bg-sunset" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-2xl bg-violet-soft p-3">
            <p className="text-2xl font-black">12</p>
            <p className="text-xs font-bold text-muted">boards found</p>
          </div>
          <div className="rounded-2xl bg-primary-soft p-3">
            <p className="text-2xl font-black">2,418</p>
            <p className="text-xs font-bold text-muted">pins fetched</p>
          </div>
        </div>
      </Frame>
    ),
  },
  {
    icon: SlidersHorizontal,
    title: '3. Filter and select',
    text: 'Search by title, description, link domain or board; filter by board, age, pin type and engagement; sort oldest-first or lowest-engagement-first. Select pins one by one, or “Select all” matches in one click.',
    mock: (
      <Frame>
        <div className="mb-3 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-primary-soft px-2.5 py-1 text-primary">Older than 3 years</span>
          <span className="rounded-full bg-sunflower-soft px-2.5 py-1 text-[#5C4A00]">No engagement</span>
          <span className="rounded-full bg-teal-soft px-2.5 py-1 text-teal">Recipes</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {SAMPLE_PINS.slice(0, 6).map((p, i) => (
            <PinTile key={p.title} {...p} h={70 + (i % 3) * 18} selected={i % 2 === 0} />
          ))}
        </div>
      </Frame>
    ),
  },
  {
    icon: CloudDownload,
    title: '4. Review and download your backup',
    text: 'The review page shows how many pins from which boards you’re about to remove. Download a JSON and CSV backup — created in your browser — and tick “I have downloaded my backup”.',
    mock: (
      <Frame>
        <p className="font-extrabold">148 pins from 3 boards</p>
        <ul className="mt-3 space-y-1.5 text-sm">
          <li className="flex justify-between">
            <span>Wedding Ideas 2019</span>
            <span className="font-bold">84</span>
          </li>
          <li className="flex justify-between">
            <span>Old Blog Graphics</span>
            <span className="font-bold">41</span>
          </li>
          <li className="flex justify-between">
            <span>Recipes to Try</span>
            <span className="font-bold">23</span>
          </li>
        </ul>
        <div className="mt-4 flex gap-2 text-xs font-bold">
          <span className="rounded-full bg-violet-soft px-3 py-1.5 text-violet">⬇ backup.json</span>
          <span className="rounded-full bg-teal-soft px-3 py-1.5 text-teal">⬇ backup.csv</span>
        </div>
      </Frame>
    ),
  },
  {
    icon: FlaskConical,
    title: '5. Try a dry run (optional)',
    text: 'Switch on “Dry run” to walk through the whole job without touching Pinterest. You get a report of exactly what would be deleted — perfect for double-checking filters.',
    mock: (
      <Frame>
        <div className="flex items-center justify-between rounded-2xl bg-tint-sun p-4">
          <div>
            <p className="font-extrabold">Dry run</p>
            <p className="text-xs text-muted">Nothing is deleted</p>
          </div>
          <span className="relative h-7 w-12 rounded-full bg-sunset">
            <span className="absolute right-1 top-1 h-5 w-5 rounded-full bg-white" />
          </span>
        </div>
      </Frame>
    ),
  },
  {
    icon: Keyboard,
    title: '6. Confirm with “DELETE”',
    text: 'For a real run, type DELETE to confirm. Free users can delete up to their remaining free deletions; for more, buy a pass right on the review page.',
    mock: (
      <Frame>
        <p className="text-sm font-bold">Type DELETE to confirm</p>
        <div className="mt-2 rounded-2xl border-2 border-violet px-4 py-3 font-mono font-bold tracking-widest">
          DELETE
        </div>
        <span className="mt-3 inline-block rounded-full bg-sunset px-5 py-2 text-sm font-bold text-white">
          Delete 148 pins
        </span>
      </Frame>
    ),
  },
  {
    icon: CheckCircle2,
    title: '7. Watch it happen — or close the tab',
    text: 'Our servers delete your pins at a safe pace with live progress, pause and resume controls, and a log of every event. If Pinterest rate-limits us, the job pauses and resumes on its own. Failed pins can be retried in one click.',
    mock: (
      <Frame>
        <div className="mb-2 flex items-center justify-between text-sm font-bold">
          <span>Running</span>
          <span>96 / 148</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full w-[65%] rounded-full bg-sunset" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold">
          <div className="rounded-2xl bg-teal-soft p-2">
            <p className="text-lg font-black">95</p>deleted
          </div>
          <div className="rounded-2xl bg-primary-soft p-2">
            <p className="text-lg font-black">1</p>failed
          </div>
          <div className="rounded-2xl bg-violet-soft p-2">
            <p className="text-lg font-black">52</p>left
          </div>
        </div>
      </Frame>
    ),
  },
  {
    icon: Mail,
    title: '8. Get the email and the report',
    text: 'When the job finishes we email you a summary (you can turn this off). Download a CSV report with every pin’s outcome from the Jobs page.',
    mock: (
      <Frame>
        <p className="font-extrabold">Your cleanup is done 🎉</p>
        <p className="mt-1 text-sm text-muted">147 deleted · 1 failed · 2m 41s</p>
        <span className="mt-3 inline-block rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-surface">
          Download report
        </span>
      </Frame>
    ),
  },
];

export default function HowItWorks() {
  return (
    <>
      <Seo
        path="/how-it-works"
        title="How it works"
        description="Step-by-step: connect Pinterest, sync, filter, back up, dry run and delete pins safely with live progress."
      />
      <PageHero
        eyebrow="How it works"
        title={
          <>
            From cluttered to <span className="text-gradient">curated</span> in 8 steps
          </>
        }
      >
        A walkthrough of everything PinDeleter does — and every safety check along the way.
      </PageHero>
      <section className="pb-20">
        <div className="container-page space-y-16">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={cn(
                'grid grid-cols-1 items-center gap-8 md:grid-cols-2',
                i % 2 === 1 && 'md:[&>*:first-child]:order-2',
              )}
            >
              <div>
                <span
                  className={cn(
                    'inline-flex h-12 w-12 items-center justify-center rounded-2xl',
                    [
                      'bg-primary-soft text-primary',
                      'bg-violet-soft text-violet',
                      'bg-teal-soft text-teal',
                      'bg-sky-soft text-sky',
                    ][i % 4],
                  )}
                >
                  <s.icon className="h-6 w-6" aria-hidden />
                </span>
                <h2 className="mt-4 text-2xl sm:text-3xl">{s.title}</h2>
                <p className="mt-3 text-lg text-muted">{s.text}</p>
              </div>
              <div className="mx-auto w-full max-w-md">{s.mock}</div>
            </div>
          ))}
          <div className="text-center">
            <ButtonLink to="/signup" size="lg">
              Start with 50 free deletions
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
