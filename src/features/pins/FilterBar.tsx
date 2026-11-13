import { useEffect, useRef, useState } from 'react';
import { Search, SlidersHorizontal, TrendingDown, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import type { BoardCount } from '@/lib/types';
import {
  AGE_LABELS,
  OWNER_LABELS,
  SORT_LABELS,
  type AgeFilter,
  type OwnerFilter,
  type PinFilterState,
  type SortOrder,
} from '@/lib/pinFilters';
import { boardTone, Input, Select, toneClass } from '@/components/ui';
import { LIMITS } from '@/config/site';

interface Props {
  filters: PinFilterState;
  onChange: (patch: Partial<PinFilterState>) => void;
  boards: BoardCount[];
  totalPins: number;
}

/** Search keeps its own state (so focus and caret never jump) and syncs to the URL after 250ms. */
function SearchBox({ value, onCommit }: { value: string; onCommit: (q: string) => void }) {
  const [text, setText] = useState(value);
  const committed = useRef(value);
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setText(value);
    }
  }, [value]);
  useEffect(() => {
    if (text === committed.current) return;
    const t = setTimeout(() => {
      committed.current = text;
      onCommit(text);
    }, LIMITS.searchDebounceMs);
    return () => clearTimeout(t);
  }, [text, onCommit]);
  return (
    <div className="relative flex-1">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search titles, descriptions, link domains, boards…"
        aria-label="Search pins"
        className="pl-12 pr-10"
      />
      {text && (
        <button
          type="button"
          onClick={() => setText('')}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-ink/5"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function FilterBar({ filters, onChange, boards, totalPins }: Props) {
  const toggleBoard = (id: string) => {
    const set = new Set(filters.boards);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ boards: [...set] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row">
        <SearchBox value={filters.q} onCommit={(q) => onChange({ q })} />
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <label className="sr-only" htmlFor="filter-sort">
            Sort
          </label>
          <Select
            id="filter-sort"
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value as SortOrder })}
            className="sm:w-48"
          >
            {(Object.keys(SORT_LABELS) as SortOrder[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </Select>
          <label className="sr-only" htmlFor="filter-owner">
            Pin type
          </label>
          <Select
            id="filter-owner"
            value={filters.owner}
            onChange={(e) => onChange({ owner: e.target.value as OwnerFilter })}
            className="sm:w-48"
          >
            {(Object.keys(OWNER_LABELS) as OwnerFilter[]).map((o) => (
              <option key={o} value={o}>
                {OWNER_LABELS[o]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        role="group"
        aria-label="Filter by board"
      >
        <button
          type="button"
          onClick={() => onChange({ boards: [] })}
          aria-pressed={filters.boards.length === 0}
          className={cn(
            'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold transition',
            filters.boards.length === 0
              ? 'bg-ink text-surface'
              : 'bg-violet-soft text-ink hover:bg-[#E2E2E2] dark:hover:bg-white/20',
          )}
        >
          All boards · {formatNumber(totalPins)}
        </button>
        {boards.map((b) => {
          const active = filters.boards.includes(b.pinterest_board_id);
          return (
            <button
              key={b.board_id}
              type="button"
              onClick={() => toggleBoard(b.pinterest_board_id)}
              aria-pressed={active}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold transition',
                active
                  ? 'bg-ink text-surface'
                  : cn(
                      toneClass(boardTone(b.pinterest_board_id)),
                      'hover:bg-[#E2E2E2] dark:hover:bg-white/20',
                    ),
              )}
            >
              {b.name} · {formatNumber(b.pin_count)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-muted">
          <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filters
        </span>
        <label className="sr-only" htmlFor="filter-age">
          Date
        </label>
        <Select
          id="filter-age"
          value={filters.age}
          onChange={(e) => onChange({ age: e.target.value as AgeFilter })}
          className="h-10 w-auto rounded-full py-0 text-sm"
        >
          {(Object.keys(AGE_LABELS) as AgeFilter[]).map((a) => (
            <option key={a} value={a}>
              {AGE_LABELS[a]}
            </option>
          ))}
        </Select>
        {filters.age === 'custom' && (
          <span className="flex items-center gap-2 text-sm">
            <label htmlFor="filter-from" className="font-bold">
              From
            </label>
            <Input
              id="filter-from"
              type="date"
              value={filters.from ?? ''}
              onChange={(e) => onChange({ from: e.target.value || null })}
              className="h-10 w-auto rounded-full text-sm"
            />
            <label htmlFor="filter-to" className="font-bold">
              to
            </label>
            <Input
              id="filter-to"
              type="date"
              value={filters.to ?? ''}
              onChange={(e) => onChange({ to: e.target.value || null })}
              className="h-10 w-auto rounded-full text-sm"
            />
          </span>
        )}
        <button
          type="button"
          aria-pressed={filters.noEngagement}
          onClick={() => onChange({ noEngagement: !filters.noEngagement })}
          className={cn(
            'inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition',
            filters.noEngagement
              ? 'bg-sunset text-white shadow-glow'
              : 'bg-sunflower-soft text-[#5C4A00] hover:brightness-95 dark:text-[#FFE97A]',
          )}
        >
          <TrendingDown className="h-4 w-4" aria-hidden /> No engagement
        </button>
      </div>
    </div>
  );
}
