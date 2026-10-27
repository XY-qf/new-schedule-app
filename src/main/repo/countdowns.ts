import { randomUUID } from 'node:crypto';
import type { Db } from '../db/driver';
import { daysUntil, nextYearlyDate } from '../../shared/todo';

export interface Countdown {
  id: string;
  title: string;
  /** 'YYYY-MM-DD' */
  targetDate: string;
  repeatYearly: boolean;
  color: string | null;
  note: string | null;
}

interface CountdownRow {
  id: string;
  title: string;
  target_date: string;
  repeat_yearly: number;
  color: string | null;
  note: string | null;
}

function toCountdown(row: CountdownRow): Countdown {
  return {
    id: row.id,
    title: row.title,
    targetDate: row.target_date,
    repeatYearly: row.repeat_yearly === 1,
    color: row.color,
    note: row.note,
  };
}

/**
 * 排序（FR-6.9）：未来在前、按日期升序；已过去的排在后面，也按日期升序。
 * 同一个日期按标题稳定排序，避免每次刷新顺序抖动。
 */
/** 每年重复的按「下一次发生日」参与排序，否则生日一过就沉到最后。 */
function effectiveDate(item: Countdown, today: string): string {
  return item.repeatYearly ? nextYearlyDate(item.targetDate, today) : item.targetDate;
}

export function sortCountdowns(items: Countdown[], today: string): Countdown[] {
  const withDate = items.map((item) => ({ item, date: effectiveDate(item, today) }));

  const future = withDate
    .filter((x) => daysUntil(x.date, today) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.item.title.localeCompare(b.item.title));
  const past = withDate
    .filter((x) => daysUntil(x.date, today) < 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.item.title.localeCompare(b.item.title));

  return [...future, ...past].map((x) => x.item);
}

export function listCountdowns(db: Db, today: string): Countdown[] {
  const rows = db.prepare('SELECT * FROM countdowns').all() as CountdownRow[];
  return sortCountdowns(rows.map(toCountdown), today);
}

export function getCountdown(db: Db, id: string): Countdown {
  const row = db.prepare('SELECT * FROM countdowns WHERE id = ?').get(id) as
    | CountdownRow
    | undefined;
  if (!row) throw new Error(`重要日不存在: ${id}`);
  return toCountdown(row);
}

export function createCountdown(
  db: Db,
  input: { title: string; targetDate: string; repeatYearly?: boolean; color?: string | null; note?: string | null },
): Countdown {
  const id = randomUUID();
  db.prepare(
    'INSERT INTO countdowns (id,title,target_date,repeat_yearly,color,show_in_todo,note) VALUES (?,?,?,?,?,0,?)',
  ).run(
    id,
    input.title,
    input.targetDate,
    input.repeatYearly ? 1 : 0,
    input.color ?? null,
    input.note ?? null,
  );
  return getCountdown(db, id);
}

export function updateCountdown(
  db: Db,
  id: string,
  patch: { title?: string; targetDate?: string; repeatYearly?: boolean; note?: string | null },
): Countdown {
  const cur = getCountdown(db, id);
  db.prepare(
    'UPDATE countdowns SET title = ?, target_date = ?, repeat_yearly = ?, note = ? WHERE id = ?',
  ).run(
    patch.title ?? cur.title,
    patch.targetDate ?? cur.targetDate,
    (patch.repeatYearly ?? cur.repeatYearly) ? 1 : 0,
    patch.note !== undefined ? patch.note : cur.note,
    id,
  );
  return getCountdown(db, id);
}

export function deleteCountdown(db: Db, id: string): void {
  db.prepare('DELETE FROM countdowns WHERE id = ?').run(id);
}
