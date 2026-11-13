// Marketing building blocks: sample pin tiles, product mockup, FAQ accordion.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { FaqItem } from '@/content/faq';
import { LogoMark } from './Logo';

export const SAMPLE_PINS = [
  { emoji: '🍋', title: 'Lemon tart', from: '#FFC83D', to: '#FF8A3D', h: 150 },
  { emoji: '🏝️', title: 'Beach escape', from: '#3BA7FF', to: '#12C2A8', h: 190 },
  { emoji: '🌸', title: 'Spring palette', from: '#FF3D7F', to: '#FFC83D', h: 130 },
  { emoji: '🪴', title: 'Balcony garden', from: '#12C2A8', to: '#FFC83D', h: 170 },
  { emoji: '🎨', title: 'Watercolor tips', from: '#7C5CFF', to: '#FF3D7F', h: 140 },
  { emoji: '🧁', title: 'Cupcake ideas', from: '#FF8A3D', to: '#FF3D7F', h: 185 },
  { emoji: '👗', title: 'Capsule wardrobe', from: '#7C5CFF', to: '#3BA7FF', h: 160 },
  { emoji: '🍜', title: 'Ramen night', from: '#FFC83D', to: '#FF3D7F', h: 135 },
  { emoji: '✈️', title: 'Road trip', from: '#3BA7FF', to: '#7C5CFF', h: 175 },
] as const;

export function PinTile({
  emoji,
  title,
  from,
  to,
  h,
  selected,
  className,
}: {
  emoji: string;
  title: string;
  from: string;
  to: string;
  h: number;
  selected?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl', className)}
      style={{ height: h, background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <div className="absolute right-3 top-3 h-10 w-10 rounded-full bg-white/20" />
      <span className="absolute inset-0 flex items-center justify-center text-4xl" aria-hidden>
        {emoji}
      </span>
      <span className="absolute bottom-2 left-2 rounded-full bg-white/85 px-2 py-0.5 text-[0.65rem] font-bold text-ink">
        {title}
      </span>
      <AnimatePresence>
        {selected && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-primary shadow"
          >
            <Check className="h-4 w-4" strokeWidth={3.5} />
          </motion.span>
        )}
      </AnimatePresence>
      {selected && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-4 ring-inset ring-white/90" />
      )}
    </div>
  );
}

/** Animated product mockup built in HTML/CSS for the hero. */
export function ProductMockup() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduce) {
      setStep(4);
      return;
    }
    const t = setInterval(() => setStep((s) => (s + 1) % 9), 1100);
    return () => clearInterval(t);
  }, [reduce]);
  const selectedIdx = [0, 2, 4, 7].slice(0, Math.min(step, 4));
  const deleting = step >= 6;
  const progress = deleting ? Math.min(100, (step - 5) * 34) : 0;

  return (
    <div className="relative mx-auto w-full max-w-[540px]" aria-hidden>
      <div className="card overflow-hidden rounded-[28px] shadow-lift">
        <div className="flex items-center gap-2 border-b border-line bg-tint-pink px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <span className="h-3 w-3 rounded-full bg-[#28C840]" />
          <div className="ml-3 flex flex-1 items-center gap-2 rounded-full bg-raised px-3 py-1 text-xs text-muted">
            <Search className="h-3.5 w-3.5" /> wedding 2019
          </div>
          <LogoMark size={22} />
        </div>
        <div className="flex gap-2 overflow-hidden px-4 pt-3">
          {['All boards · 312', 'Wedding Ideas · 84', 'Old Blog · 41', 'Recipes · 66'].map((b, i) => (
            <span
              key={b}
              className={cn(
                'whitespace-nowrap rounded-full px-3 py-1 text-[0.7rem] font-bold',
                [
                  'bg-ink text-surface',
                  'bg-violet-soft text-ink',
                  'bg-violet-soft text-ink',
                  'bg-violet-soft text-ink',
                ][i],
              )}
            >
              {b}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2.5 p-4">
          {[0, 1, 2].map((col) => (
            <div key={col} className="flex flex-col gap-2.5">
              {SAMPLE_PINS.filter((_, i) => i % 3 === col).map((p) => {
                const idx = SAMPLE_PINS.indexOf(p);
                const isSel = selectedIdx.includes(idx);
                return (
                  <motion.div
                    key={p.title}
                    animate={
                      deleting && isSel
                        ? { opacity: 0, x: 80, rotate: 8, scale: 0.8 }
                        : { opacity: 1, x: 0, rotate: 0, scale: isSel ? 0.96 : 1 }
                    }
                    transition={{ duration: 0.5, delay: deleting ? selectedIdx.indexOf(idx) * 0.15 : 0 }}
                  >
                    <PinTile {...p} h={Math.round(p.h * 0.62)} selected={isSel} />
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="border-t border-line bg-raised px-4 py-3">
          {deleting ? (
            <div>
              <div className="mb-1.5 flex justify-between text-xs font-bold">
                <span>Deleting… {Math.round((progress / 100) * 4)} of 4</span>
                <span className="text-success">Backup saved ✓</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-ink/10">
                <div
                  className="h-full rounded-full bg-sunset transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-sm font-bold">
              <span>{selectedIdx.length} selected</span>
              <span className="rounded-full bg-sunset px-3 py-1 text-xs text-white">Review →</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FaqList({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-line rounded-4xl border border-line bg-raised shadow-card">
      {items.map((item, i) => {
        const isOpen = open === i;
        const id = `faq-${i}`;
        return (
          <div key={item.q}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${id}-panel`}
                id={`${id}-button`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-[1.05rem] font-extrabold"
              >
                {item.q}
                <ChevronDown
                  className={cn('h-5 w-5 shrink-0 text-primary transition-transform', isOpen && 'rotate-180')}
                  aria-hidden
                />
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={`${id}-panel`}
                  role="region"
                  aria-labelledby={`${id}-button`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <p className="px-6 pb-6 leading-relaxed text-muted">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export function FloatingPins() {
  // Peeking in from the section edges so they never cover the headline or the mockup.
  const picks = [
    { p: SAMPLE_PINS[1], cls: '-left-12 top-[12%] w-24', r: '-10deg', delay: '0s' },
    { p: SAMPLE_PINS[5], cls: '-right-10 bottom-[8%] w-24', r: '8deg', delay: '-2s' },
    { p: SAMPLE_PINS[3], cls: '-left-8 bottom-[-3rem] w-20', r: '6deg', delay: '-4s' },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden 2xl:block">
      {picks.map(({ p, cls, r, delay }) => (
        <div
          key={p.title}
          className={cn('absolute animate-float opacity-90', cls)}
          style={{ ['--r' as string]: r, animationDelay: delay }}
        >
          <PinTile {...p} h={Math.round(p.h * 0.75)} className="shadow-lift" />
        </div>
      ))}
    </div>
  );
}
