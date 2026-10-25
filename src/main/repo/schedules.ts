import { randomUUID } from 'node:crypto';
import type { Db } from '../db/driver';
import type { Schedule, TimeType } from '../../shared/types';
import { addDays, nowLocal } from '../../shared/time';

export interface ScheduleInput {
  title: string;
  categoryId: string;
  timeType: TimeType;
  isAllDay: boolean;
  startAt: string | null;
  endAt: string | null;
  recurrenceId?: string | null;
  periodStart?: number | null;
  periodEnd?: number | null;
  sortHint?: number | null;
  location?: string | null;
  note?: string | null;
  isInTodo?: boolean;
}

interface ScheduleRow {
  id: string;
  title: string;
  category_id: string;
  time_type: TimeType;
  is_all_day: number;
  start_at: string | null;
  end_at: string | null;
  recurrence_id: string | null;
  period_start: number | null;
  period_end: number | null;
  sort_hint: number | null;
  location: string | null;
  note: string | null;
  is_in_todo: number;
  is_done: number;
  done_at: string | null;
  created_at: string;
  updated_at: string;
}

function toSchedule(row: ScheduleRow): Schedule {
  return {
    id: row.id,
    title: row.title,
    categoryId: row.category_id,
    timeType: row.time_type,
    isAllDay: row.is_all_day === 1,
    startAt: row.start_at,
    endAt: row.end_at,
    recurrenceId: row.recurrence_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    sortHint: row.sort_hint,
    location: row.location,
    note: row.note,
    isInTodo: row.is_in_todo === 1,
    isDone: row.is_done === 1,
    doneAt: row.done_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 排序键：COALESCE(start_at, end_at, created_at)，再按 sort_hint。 */
function sortKey(s: Schedule): string {
  return s.startAt ?? s.endAt ?? s.createdAt;
}

export function getSchedule(db: Db, id: string): Schedule {
  const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as
    | ScheduleRow
    | undefined;
  if (!row) throw new Error(`日程不存在: ${id}`);
  return toSchedule(row);
}

export function createSchedule(db: Db, input: ScheduleInput): Schedule {
  const id = randomUUID();
  const now = nowLocal();

  db.prepare(
    `INSERT INTO schedules
      (id,title,category_id,time_type,is_all_day,start_at,end_at,recurrence_id,
       period_start,period_end,sort_hint,location,note,is_in_todo,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    input.title,
    input.categoryId,
    input.timeType,
    input.isAllDay ? 1 : 0,
    input.startAt,
    input.endAt,
    input.recurrenceId ?? null,
    input.periodStart ?? null,
    input.periodEnd ?? null,
    input.sortHint ?? null,
    input.location ?? null,
    input.note ?? null,
    input.isInTodo ? 1 : 0,
    now,
    now,
  );

  return getSchedule(db, id);
}

export function updateSchedule(
  db: Db,
  id: string,
  patch: Partial<ScheduleInput> & { isDone?: boolean },
): Schedule {
  const cur = getSchedule(db, id);
  const now = nowLocal();

  const isDone = patch.isDone ?? cur.isDone;
  const doneAt = isDone ? (cur.doneAt ?? now) : null;

  db.prepare(
    `UPDATE schedules SET
       title = ?, category_id = ?, time_type = ?, is_all_day = ?,
       start_at = ?, end_at = ?, recurrence_id = ?,
       period_start = ?, period_end = ?, sort_hint = ?,
       location = ?, note = ?, is_in_todo = ?, is_done = ?, done_at = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    patch.title ?? cur.title,
    patch.categoryId ?? cur.categoryId,
    patch.timeType ?? cur.timeType,
    (patch.isAllDay ?? cur.isAllDay) ? 1 : 0,
    patch.startAt !== undefined ? patch.startAt : cur.startAt,
    patch.endAt !== undefined ? patch.endAt : cur.endAt,
    patch.recurrenceId !== undefined ? patch.recurrenceId : cur.recurrenceId,
    patch.periodStart !== undefined ? patch.periodStart : cur.periodStart,
    patch.periodEnd !== undefined ? patch.periodEnd : cur.periodEnd,
    patch.sortHint !== undefined ? patch.sortHint : cur.sortHint,
    patch.location !== undefined ? patch.location : cur.location,
    patch.note !== undefined ? patch.note : cur.note,
    (patch.isInTodo ?? cur.isInTodo) ? 1 : 0,
    isDone ? 1 : 0,
    doneAt,
    now,
    id,
  );

  return getSchedule(db, id);
}

export function deleteSchedule(db: Db, id: string): void {
  db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
}

/**
 * 取某日期区间内可见的日程（含重复日程的锚点行）。
 *
 * 两支查询，不能用单一 `start_at >= ?`：
 *  - 非重复：用 COALESCE 做「与窗口有交集」判断。end_only 的 start_at 为 NULL、
 *    跨天日程的 start_at 早于窗口，裸比较都会漏掉（契约审查 C1/C2）。
 *  - 重复：锚点是序列起点，只要求「锚点早于窗口末尾」且「重复尚未结束」，
 *    真正的实例展开交给 expandOccurrences。
 */
export function listSchedulesByRange(db: Db, start: string, end: string): Schedule[] {
  const from = `${start}T00:00:00`;
  const to = `${addDays(end, 1)}T00:00:00`;

  const singles = db
    .prepare(
      `SELECT * FROM schedules
       WHERE recurrence_id IS NULL
         AND COALESCE(start_at, end_at) < ?
         AND COALESCE(end_at, start_at) >= ?`,
    )
    .all(to, from) as ScheduleRow[];

  const recurring = db
    .prepare(
      `SELECT s.* FROM schedules s
       JOIN recurrences r ON r.id = s.recurrence_id
       WHERE s.start_at < ?
         AND (r.until_date IS NULL OR r.until_date >= ?)`,
    )
    .all(to, start) as ScheduleRow[];

  return [...singles, ...recurring]
    .map(toSchedule)
    .sort((a, b) => {
      const byKey = sortKey(a).localeCompare(sortKey(b));
      if (byKey !== 0) return byKey;
      return (a.sortHint ?? 0) - (b.sortHint ?? 0);
    });
}