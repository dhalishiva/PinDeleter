import { Eye, Hand, Lock } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { ButtonLink } from '@/components/Button';
import { AboutIllustration } from '@/components/Illustrations';
import { SectionHeading } from '@/components/ui';
import { SITE } from '@/config/site';
import { PageHero } from './PageHero';

const VALUES = [
  {
    icon: Lock,
    title: 'Privacy first',
    text: 'We ask Pinterest only for the permissions the product needs, encrypt access tokens, keep data for as short a time as possible, and never sell or share it.',
    tone: 'bg-violet-soft text-violet',
  },
  {
    icon: Hand,
    title: 'You stay in control',
    text: 'Nothing is deleted until you review the list, download a backup and confirm. You can pause or cancel any job at any time.',
    tone: 'bg-primary-soft text-primary',
  },
  {
    icon: Eye,
    title: 'Radical transparency',
    text: 'Live progress, a log of every event and a downloadable report of every pin’s outcome. Clear prices, no subscriptions, honest refunds.',
    tone: 'bg-teal-soft text-teal',
  },
];

export default function About() {
  return (
    <>
      <Seo
        path="/about"
        title="About"
        description="PinDeleter is an independent tool built by a solo founder at Kriosity to make cleaning up Pinterest safe and simple."
      />
      <PageHero
        eyebrow="About"
        title={
          <>
            A small tool with <span className="text-gradient">one big job</span>
          </>
        }
      />
      <section className="pb-16">
        <div className="container-page grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <AboutIllustration className="mx-auto w-full max-w-md" />
          <div className="space-y-4 text-lg leading-relaxed text-ink/85">
            <p>
              PinDeleter started with a simple frustration: years of pins — old recipes, a wedding that
              happened long ago, graphics from a blog that no longer exists — and no sensible way to clear
              them out. Deleting pins one at a time is slow, and the tools that promised to help wanted a
              password or quietly ran scripts in the browser.
            </p>
            <p>
              So PinDeleter was built the careful way: with Pinterest’s official API, server-side jobs that
              respect Pinterest’s limits, a backup before anything is removed, and a dry run so you can see
              the result first.
            </p>
            <p>
              It’s an independent product made by a solo founder at{' '}
              <a
                href={SITE.operatorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-violet hover:underline"
              >
                Kriosity
              </a>
              , based in Noida, India — and used by pinners all over the world.
            </p>
          </div>
        </div>
      </section>
      <section className="bg-tint-pink py-16">
        <div className="container-page max-w-3xl text-center">
          <SectionHeading
            eyebrow="Our mission"
            title="Make it easy to own your Pinterest profile"
            subtitle="Your boards should reflect who you are today. We help you get there quickly, safely and without giving up control of your account."
          />
        </div>
      </section>
      <section className="py-16">
        <div className="container-page">
          <SectionHeading eyebrow="Values" title="What we care about" />
          <div className="grid gap-6 md:grid-cols-3">
            {VALUES.map((v) => (
              <div key={v.title} className="card p-7">
                <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${v.tone}`}>
                  <v.icon className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="mt-5 text-xl">{v.title}</h3>
                <p className="mt-2 text-muted">{v.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 text-center">
            <ButtonLink to="/signup" size="lg">
              Try PinDeleter free
            </ButtonLink>
            <p className="mt-6 text-sm text-muted">{SITE.disclaimer}</p>
          </div>
        </div>
      </section>
    </>
  );
}
