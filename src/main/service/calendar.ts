import type { Db } from '../db/driver';
import type { OccurrenceView, Schedule } from '../../shared/types';
import { expandOccurrences, type Recurrence } from '../../shared/recurrence';
import { listCategories } from '../repo/categories';
import { listSchedulesByRange } from '../repo/schedules';

interface RecurrenceRow {
  id: string;
  freq: Recurrence['freq'];
  interval: number | null;
  by_weekday: string | null;
  by_monthday: number | null;
  until_date: string | null;
}

function getRecurrence(db: Db, id: string): Recurrence | null {
  const row = db.prepare('SELECT * FROM recurrences WHERE id = ?').get(id) as
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

/**
 * 把一行日程展开成「落在窗口内的实例视图」：
 * 重复日程按规则展开，单次日程最多产出一条。分类颜色在这里一次性补好，
 * 渲染进程不再自己查（见计划 1.3 的 OccurrenceView）。
 */
export function listOccurrenceViews(db: Db, start: string, end: string): OccurrenceView[] {
  const colorByCategory = new Map(listCategories(db).map((c) => [c.id, c.color]));
  const schedules = listSchedulesByRange(db, start, end);

  const views: OccurrenceView[] = [];

  for (const schedule of schedules) {
    const recurrence = schedule.recurrenceId ? getRecurrence(db, schedule.recurrenceId) : null;
    const occurrences = expandOccurrences(schedule, recurrence, start, end);

    for (const occurrence of occurrences) {
      views.push({
        scheduleId: occurrence.scheduleId,
        startAt: occurrence.startAt,
        endAt: occurrence.endAt,
        isAllDay: occurrence.isAllDay,
        title: schedule.title,
        categoryId: schedule.categoryId,
        categoryColor: colorByCategory.get(schedule.categoryId) ?? '#8E8E93',
        timeType: schedule.timeType,
        isDone: schedule.isDone,
      });
    }
  }

  return views.sort((a, b) => {
    const keyA = a.startAt ?? a.endAt ?? '';
    const keyB = b.startAt ?? b.endAt ?? '';
    return keyA.localeCompare(keyB);
  });
}

export type { Schedule };