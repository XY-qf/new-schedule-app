import type { Db } from '../db/driver';
import { addDays } from '../../shared/time';

export interface ScheduleException {
  scheduleId: string;
  /** 实例的身份键：展开时算出来的**原始** start_at（end_only 用 end_at） */
  occurrenceStart: string;
  isDeleted: boolean;
  isDone: boolean;
  doneAt: string | null;
  override: {
    title?: string;
    startAt?: string | null;
    endAt?: string | null;
  } | null;
}

interface ExceptionRow {
  schedule_id: string;
  occurrence_start: string;
  is_deleted: number;
  is_done: number;
  done_at: string | null;
  override_json: string | null;
}

function toException(row: ExceptionRow): ScheduleException {
  let override: ScheduleException['override'] = null;
  if (row.override_json) {
    try {
      override = JSON.parse(row.override_json) as ScheduleException['override'];
    } catch {
      override = null;
    }
  }

  return {
    scheduleId: row.schedule_id,
    occurrenceStart: row.occurrence_start,
    isDeleted: row.is_deleted === 1,
    isDone: row.is_done === 1,
    doneAt: row.done_at,
    override,
  };
}

/** 实例的身份键。end_only 没有 start_at，用 end_at 当锚点。 */
export function occurrenceKey(occurrence: { startAt: string | null; endAt: string | null }): string {
  return occurrence.startAt ?? occurrence.endAt ?? '';
}

/**
 * 写入/更新一条例外。身份键是**原始** occurrenceStart——
 * 改过时间的实例再次编辑时，调用方必须仍然传原始时间，否则会造出第二条例外。
 */
export function upsertException(
  db: Db,
  input: {
    scheduleId: string;
    occurrenceStart: string;
    isDeleted?: boolean;
    isDone?: boolean;
    doneAt?: string | null;
    override?: ScheduleException['override'];
  },
): void {
  const existing = getException(db, input.scheduleId, input.occurrenceStart);

  const isDeleted = input.isDeleted ?? existing?.isDeleted ?? false;
  const isDone = input.isDone ?? existing?.isDone ?? false;
  const doneAt = input.doneAt !== undefined ? input.doneAt : (existing?.doneAt ?? null);
  const override =
    input.override !== undefined ? input.override : (existing?.override ?? null);

  db.prepare(
    `INSERT INTO schedule_exceptions
       (schedule_id, occurrence_start, is_deleted, override_json, is_done, done_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(schedule_id, occurrence_start) DO UPDATE SET
       is_deleted = excluded.is_deleted,
       override_json = excluded.override_json,
       is_done = excluded.is_done,
       done_at = excluded.done_at`,
  ).run(
    input.scheduleId,
    input.occurrenceStart,
    isDeleted ? 1 : 0,
    override ? JSON.stringify(override) : null,
    isDone ? 1 : 0,
    doneAt,
  );
}

export function getException(
  db: Db,
  scheduleId: string,
  occurrenceStart: string,
): ScheduleException | null {
  const row = db
    .prepare('SELECT * FROM schedule_exceptions WHERE schedule_id = ? AND occurrence_start = ?')
    .get(scheduleId, occurrenceStart) as ExceptionRow | undefined;
  return row ? toException(row) : null;
}

/**
 * 取一段时间内的例外。前后各放宽几天：
 * 被改到窗口边界的实例，它的身份键可能落在窗口外。
 */
export function listExceptions(db: Db, from: string, to: string, padDays = 7): ScheduleException[] {
  const rows = db
    .prepare(
      `SELECT * FROM schedule_exceptions
       WHERE occurrence_start >= ? AND occurrence_start <= ?`,
    )
    .all(addDays(from, -padDays), `${addDays(to, padDays)}T23:59:59`) as ExceptionRow[];

  return rows.map(toException);
}
