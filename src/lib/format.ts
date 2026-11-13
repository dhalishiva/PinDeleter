const nf = new Intl.NumberFormat('en-US');

export const formatNumber = (n: number) => nf.format(n);

export function formatDate(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', opts);
}

export function formatDateTime(iso: string | null | undefined): string {
  return formatDate(iso, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatMonthYear(iso: string | null | undefined): string {
  return formatDate(iso, { month: 'short', year: 'numeric' });
}

export function formatTime(iso: string | null | undefined): string {
  return formatDate(iso, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'never';
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  return formatDate(iso);
}

export function daysLeft(iso: string | null | undefined, now = Date.now()): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86_400_000));
}

export function pluralize(n: number, word: string, plural = `${word}s`): string {
  return `${formatNumber(n)} ${n === 1 ? word : plural}`;
}

export function durationBetween(start: string | null, end: string | null, now = Date.now()): string {
  if (!start) return '—';
  const ms = (end ? new Date(end).getTime() : now) - new Date(start).getTime();
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`;
}
