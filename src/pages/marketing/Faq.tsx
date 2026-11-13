import { Link } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { FaqList } from '@/components/marketing';
import { FAQ, type FaqItem } from '@/content/faq';
import { PageHero } from './PageHero';

const GROUPS: { id: FaqItem['category']; title: string }[] = [
  { id: 'general', title: 'Using PinDeleter' },
  { id: 'safety', title: 'Safety & your account' },
  { id: 'billing', title: 'Plans & billing' },
  { id: 'privacy', title: 'Privacy & data' },
];

export default function Faq() {
  return (
    <>
      <Seo
        path="/faq"
        title="FAQ"
        description="Answers about bulk-deleting Pinterest pins with PinDeleter: safety, backups, dry runs, rate limits, plans, refunds and privacy."
      />
      <PageHero eyebrow="FAQ" title="Frequently asked questions">
        Can’t find your answer?{' '}
        <Link to="/contact" className="font-bold text-violet hover:underline">
          Contact us
        </Link>{' '}
        — a real person replies.
      </PageHero>
      <section className="pb-20">
        <div className="container-page max-w-3xl space-y-12">
          {GROUPS.map((g) => (
            <div key={g.id}>
              <h2 className="mb-4 text-2xl">{g.title}</h2>
              <FaqList items={FAQ.filter((f) => f.category === g.id)} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
