import { describe, expect, it } from 'vitest';
import { BACKUP_COLUMNS, backupCsv, backupJson, csvField, reportCsv, toBackupRow } from './backup';
import type { JobItem, Pin } from './types';

const pin = (over: Partial<Pin> = {}): Pin => ({
  id: 'uuid-1',
  connection_id: 'c1',
  pinterest_pin_id: '1234567890',
  board_id: 'b1',
  pinterest_board_id: 'pb1',
  board_name: 'Recipes',
  title: 'Lemon tart',
  description: 'Tangy, "zesty" and sweet,\nwith a crunchy base',
  link: 'https://example.com/tart?a=1,2',
  link_domain: 'example.com',
  image_url: 'https://i.pinimg.com/600x/aa.jpg',
  image_width: 600,
  image_height: 900,
  dominant_color: '#fff',
  created_at_pinterest: '2020-05-01T10:00:00.000Z',
  is_owner: true,
  saves: 3,
  clicks: 0,
  impressions: 40,
  engagement_fetched_at: '2026-11-01T00:00:00.000Z',
  status: 'active',
  sort_key: 0,
  ...over,
});

function parseCsv(text: string): string[][] {
  // Minimal RFC 4180 parser for assertions.
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r' && s[i + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else field += c;
  }
  return rows;
}

describe('backup CSV', () => {
  it('has the documented columns in order', () => {
    const rows = parseCsv(backupCsv([pin()]));
    expect(rows[0]).toEqual([...BACKUP_COLUMNS]);
    expect(BACKUP_COLUMNS).toEqual([
      'pin_id',
      'board',
      'title',
      'description',
      'link',
      'image_url',
      'created_at',
      'saves',
      'clicks',
    ]);
  });

  it('escapes quotes, commas and newlines and round-trips', () => {
    const rows = parseCsv(backupCsv([pin()]));
    expect(rows[1]).toEqual([
      '1234567890',
      'Recipes',
      'Lemon tart',
      'Tangy, "zesty" and sweet,\nwith a crunchy base',
      'https://example.com/tart?a=1,2',
      'https://i.pinimg.com/600x/aa.jpg',
      '2020-05-01T10:00:00.000Z',
      '3',
      '0',
    ]);
  });

  it('starts with a UTF-8 BOM and uses CRLF line endings', () => {
    const csv = backupCsv([pin(), pin({ id: 'u2', pinterest_pin_id: '2' })]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(4);
  });

  it('neutralises spreadsheet formula injection', () => {
    expect(csvField('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvField('+1')).toBe("'+1");
    expect(csvField('@cmd')).toBe("'@cmd");
  });

  it('leaves empty values blank and drops inline demo images', () => {
    const row = toBackupRow(pin({ title: null, saves: null, image_url: 'data:image/svg+xml,abc' }));
    expect(row.title).toBe('');
    expect(row.image_url).toBe('');
    expect(csvField(row.saves)).toBe('');
  });

  it('keeps emoji and accents intact', () => {
    const rows = parseCsv(backupCsv([pin({ title: 'Crème brûlée 🍮' })]));
    expect(rows[1]![2]).toBe('Crème brûlée 🍮');
  });
});

describe('backup JSON', () => {
  it('includes metadata and rows', () => {
    const json = JSON.parse(backupJson([pin()], { username: 'ann', exportedAt: '2026-11-13T00:00:00Z' })) as {
      account: string;
      count: number;
      pins: { pin_id: string }[];
    };
    expect(json.account).toBe('ann');
    expect(json.count).toBe(1);
    expect(json.pins[0]!.pin_id).toBe('1234567890');
  });
});

describe('job report CSV', () => {
  it('lists every item with its outcome', () => {
    const item: JobItem = {
      id: 'i1',
      job_id: 'j1',
      pinterest_pin_id: '99',
      status: 'failed',
      reason: null,
      attempts: 3,
      last_http_status: 500,
      last_error: 'HTTP 500 after 3 attempts',
      processed_at: '2026-11-13T00:00:00Z',
      title: 'x',
      link: null,
      board_name: 'B',
      image_url: null,
      created_at_pinterest: null,
    };
    const rows = parseCsv(reportCsv([item]));
    expect(rows[0]![1]).toBe('outcome');
    expect(rows[1]!.slice(0, 5)).toEqual(['99', 'failed', '', '3', '500']);
  });
});
