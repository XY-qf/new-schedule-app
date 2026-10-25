import type { Db } from '../db/driver';

/** 设置项的默认值（PRD 6.9）。读不到时用这里的值。 */
export const SETTING_DEFAULTS: Record<string, string> = {
  countdown_collapsed: 'true',
  snapshot_keep_days: '7',
  auto_snapshot_time: '03:00',
};

export function getSetting(db: Db, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  if (row) return row.value;
  return SETTING_DEFAULTS[key] ?? null;
}

export function setSetting(db: Db, key: string, value: string): void {
  db.prepare(
    'INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, value);
}

export function getBooleanSetting(db: Db, key: string, fallback = false): boolean {
  const raw = getSetting(db, key);
  if (raw === null) return fallback;
  return raw === 'true' || raw === '1';
}
