import type { Db } from '../db/driver';
import type { Recurrence } from '../../shared/recurrence';

interface RecurrenceRow {
  id: string;
  freq: Recurrence['freq'];
  interval: number | null;
  by_weekday: string | null;
  by_monthday: number | null;
  until_date: string | null;
}

/** 取某条重复规则；日程没挂规则时返回 null。 */
export function getRecurrenceFor(db: Db, recurrenceId: string | null): Recurrence | null {
  if (!recurrenceId) return null;
  const row = db.prepare('SELECT * FROM recurrences WHERE id = ?').get(recurrenceId) as
    | RecurrenceRow
    | undefined;
  if (!row) return null;

  return {
    id: row.id,
    freq: row.freq,
    interval: row.interval,
    byWeekday: row.by_weekday
      ? row.by_weekday.split(',').map(Number).filter((n) => !Number.isNaN(n))
      : null,
    byMonthday: row.by_monthday,
    untilDate: row.until_date,
  };
}
