import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import { ButtonLink } from '@/components/Button';
import { formatNumber } from '@/lib/format';

export function SelectionBar({ count, onClear }: { count: number; onClear: () => void }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="fixed inset-x-0 bottom-[4.5rem] z-30 px-4 md:bottom-6"
          role="region"
          aria-label="Selection"
        >
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-full border border-line bg-ink py-2 pl-5 pr-2 text-surface shadow-lift">
            <span className="font-extrabold" aria-live="polite">
              {formatNumber(count)} selected
            </span>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold text-surface/80 hover:bg-white/10"
            >
              <X className="h-4 w-4" aria-hidden /> Clear
            </button>
            <ButtonLink
              to="/app/review"
              size="sm"
              className="ml-auto"
              icon={<ArrowRight className="h-4 w-4" aria-hidden />}
            >
              Review
            </ButtonLink>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
