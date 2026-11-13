// Client-side backup generation (JSON + CSV) for selected pins, and job reports.
import type { JobItem, Pin } from './types';

export const BACKUP_COLUMNS = [
  'pin_id',
  'board',
  'title',
  'description',
  'link',
  'image_url',
  'created_at',
  'saves',
  'clicks',
] as const;

export interface BackupRow {
  pin_id: string;
  board: string;
  title: string;
  description: string;
  link: string;
  image_url: string;
  created_at: string;
  saves: number | null;
  clicks: number | null;
}

export function toBackupRow(pin: Pin): BackupRow {
  return {
    pin_id: pin.pinterest_pin_id,
    board: pin.board_name ?? '',
    title: pin.title ?? '',
    description: pin.description ?? '',
    link: pin.link ?? '',
    // Demo images are inline SVGs; they are not useful in a backup file.
    image_url: pin.image_url && !pin.image_url.startsWith('data:') ? pin.image_url : '',
    created_at: pin.created_at_pinterest ?? '',
    saves: pin.saves,
    clicks: pin.clicks,
  };
}

/** RFC 4180 field escaping; also neutralises spreadsheet formula injection. */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: readonly string[], rows: readonly Record<string, unknown>[]): string {
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => csvField(row[h])).join(','));
  // BOM so Excel opens UTF-8 (emoji, accents) correctly.
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function backupCsv(pins: readonly Pin[]): string {
  return toCsv(BACKUP_COLUMNS, pins.map(toBackupRow) as unknown as Record<string, unknown>[]);
}

export function backupJson(pins: readonly Pin[], meta: { username: string; exportedAt?: string }): string {
  return JSON.stringify(
    {
      product: 'PinDeleter by Kriosity',
      account: meta.username,
      exported_at: meta.exportedAt ?? new Date().toISOString(),
      count: pins.length,
      pins: pins.map(toBackupRow),
    },
    null,
    2,
  );
}

export const REPORT_COLUMNS = [
  'pin_id',
  'outcome',
  'reason',
  'attempts',
  'http_status',
  'error',
  'processed_at',
  'board',
  'title',
  'link',
  'image_url',
  'created_at',
] as const;

export function reportCsv(items: readonly JobItem[]): string {
  return toCsv(
    REPORT_COLUMNS,
    items.map((i) => ({
      pin_id: i.pinterest_pin_id,
      outcome: i.status,
      reason: i.reason ?? '',
      attempts: i.attempts,
      http_status: i.last_http_status ?? '',
      error: i.last_error ?? '',
      processed_at: i.processed_at ?? '',
      board: i.board_name ?? '',
      title: i.title ?? '',
      link: i.link ?? '',
      image_url: i.image_url ?? '',
      created_at: i.created_at_pinterest ?? '',
    })),
  );
}
