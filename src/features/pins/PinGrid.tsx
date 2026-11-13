import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { Check, Link2, MousePointerClick, Bookmark, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatMonthYear, formatNumber } from '@/lib/format';
import type { Pin } from '@/lib/types';
import { boardTone, toneClass } from '@/components/ui';

function useLanes(ref: React.RefObject<HTMLElement>) {
  const [state, setState] = useState({ lanes: 2, width: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const lanes = w < 560 ? 2 : w < 820 ? 3 : w < 1060 ? 4 : w < 1260 ? 5 : 6;
      setState((s) => (s.lanes === lanes && s.width === w ? s : { lanes, width: w }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return state;
}

const GAP = 14;
const CARD_META_HEIGHT = 92;

interface PinCardProps {
  pin: Pin;
  selected: boolean;
  onToggle: (id: string) => void;
}

export const PinCard = memo(function PinCard({ pin, selected, onToggle }: PinCardProps) {
  const ratio = pin.image_width && pin.image_height ? pin.image_height / pin.image_width : 1.25;
  const hasStats = pin.engagement_fetched_at && pin.saves !== null;
  return (
    <motion.button
      type="button"
      onClick={() => onToggle(pin.id)}
      aria-pressed={selected}
      aria-label={`${selected ? 'Unselect' : 'Select'} pin ${pin.title ?? pin.pinterest_pin_id}`}
      animate={{ scale: selected ? 0.965 : 1 }}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      className={cn(
        'group relative block w-full overflow-hidden rounded-3xl border-2 bg-raised text-left shadow-card transition-colors',
        selected ? 'border-primary shadow-glow' : 'border-transparent hover:shadow-lift',
      )}
    >
      <div
        className="relative w-full overflow-hidden"
        style={{
          paddingBottom: `${Math.min(Math.max(ratio, 0.6), 1.9) * 100}%`,
          background: pin.dominant_color ?? '#F4F1FF',
        }}
      >
        {pin.image_url && (
          <img
            src={pin.image_url}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <span
          className={cn(
            'absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 transition',
            selected
              ? 'border-white bg-primary text-white'
              : 'border-white/90 bg-black/15 text-transparent group-hover:bg-white/80',
          )}
        >
          {selected && (
            <motion.span
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 18 }}
            >
              <Check className="h-4 w-4" strokeWidth={3.5} />
            </motion.span>
          )}
        </span>
        {pin.status === 'failed' && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[0.7rem] font-bold text-danger">
            <AlertCircle className="h-3 w-3" aria-hidden /> Failed before
          </span>
        )}
        {!pin.is_owner && (
          <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2 py-0.5 text-[0.7rem] font-bold text-ink">
            Saved
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <p className="line-clamp-2 text-sm font-bold leading-snug text-ink">
          {pin.title || pin.description || 'Untitled pin'}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {pin.board_name && (
            <span
              className={cn(
                'max-w-full truncate rounded-full px-2 py-0.5 text-[0.7rem] font-bold',
                toneClass(boardTone(pin.pinterest_board_id ?? pin.board_name)),
              )}
            >
              {pin.board_name}
            </span>
          )}
          <span className="text-[0.72rem] font-semibold text-muted">
            {formatMonthYear(pin.created_at_pinterest)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[0.72rem] font-semibold text-muted">
          {hasStats && (
            <>
              <span className="inline-flex items-center gap-1" title="Saves (90 days)">
                <Bookmark className="h-3 w-3" aria-hidden />
                {formatNumber(pin.saves ?? 0)}
              </span>
              <span className="inline-flex items-center gap-1" title="Clicks (90 days)">
                <MousePointerClick className="h-3 w-3" aria-hidden />
                {formatNumber(pin.clicks ?? 0)}
              </span>
            </>
          )}
          {pin.link_domain && (
            <span className="inline-flex min-w-0 items-center gap-1 truncate">
              <Link2 className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{pin.link_domain}</span>
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
});

interface PinGridProps {
  pins: Pin[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

/** Virtualised masonry grid (2–6 columns) that stays smooth with 5,000+ pins. */
export function PinGrid({
  pins,
  selected,
  onToggle,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: PinGridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { lanes, width } = useLanes(ref);
  const [scrollMargin, setScrollMargin] = useState(0);
  // Content above the grid (filters, banners) can change height: re-measure whenever the page resizes.
  useLayoutEffect(() => {
    const measure = () => {
      const next = ref.current ? Math.round(ref.current.getBoundingClientRect().top + window.scrollY) : 0;
      setScrollMargin((prev) => (prev === next ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);
  const colWidth = width > 0 ? (width - GAP * (lanes - 1)) / lanes : 200;

  const virtualizer = useWindowVirtualizer({
    count: pins.length,
    lanes,
    gap: GAP,
    overscan: 8,
    scrollMargin,
    estimateSize: (i) => {
      const p = pins[i];
      const ratio = p?.image_width && p.image_height ? p.image_height / p.image_width : 1.25;
      return colWidth * Math.min(Math.max(ratio, 0.6), 1.9) + CARD_META_HEIGHT;
    },
    getItemKey: (i) => pins[i]?.id ?? i,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [lanes, colWidth, virtualizer]);

  const items = virtualizer.getVirtualItems();
  const last = items[items.length - 1];
  useEffect(() => {
    if (last && last.index >= pins.length - 12 && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [last, pins.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div ref={ref} className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
      {items.map((item) => {
        const pin = pins[item.index]!;
        return (
          <div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="absolute top-0"
            style={{
              width: colWidth,
              left: item.lane * (colWidth + GAP),
              transform: `translateY(${item.start - scrollMargin}px)`,
            }}
          >
            <PinCard pin={pin} selected={selected.has(pin.id)} onToggle={onToggle} />
          </div>
        );
      })}
    </div>
  );
}
