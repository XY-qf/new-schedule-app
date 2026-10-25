import { randomUUID } from 'node:crypto';
import type { Db } from '../db/driver';
import { addDays } from '../../shared/time';
import { expandOccurrences } from '../../shared/recurrence';
import { listSchedulesByRange } from './schedules';
import { getRecurrenceFor } from './recurrences';

export interface Reminder {
  id: string;
  scheduleId: string;
  offsetMinutes: number | null;
  dayOffset: number | null;
  atTime: string | null;
  enabled: boolean;
  lastFiredAt: string | null;
}

interface ReminderRow {
  id: string;
  owner_id: string;
  offset_minutes: number | null;
  day_offset: number | null;
  at_time: string | null;
  enabled: number;
  last_fired_at: string | null;
}

function toReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    scheduleId: row.owner_id,
    offsetMinutes: row.offset_minutes,
    dayOffset: row.day_offset,
    atTime: row.at_time,
    enabled: row.enabled === 1,
    lastFiredAt: row.last_fired_at,
  };
}

export function listReminders(db: Db, scheduleId?: string): Reminder[] {
  const rows = scheduleId
    ? (db.prepare('SELECT * FROM reminders WHERE owner_id = ? ORDER BY id').all(scheduleId) as ReminderRow[])
    : (db.prepare('SELECT * FROM reminders ORDER BY id').all() as ReminderRow[]);
  return rows.map(toReminder);
}

/**
 * 一个日程只能有一条提醒（PRD 6.10），所以按 owner 覆盖写。
 * offset_minutes 与 day_offset 二选一，由 DDL 的 CHECK 保证。
 */
export function upsertReminder(
  db: Db,
  input: {
    scheduleId: string;
    offsetMinutes?: number | null;
    dayOffset?: number | null;
    atTime?: string | null;
    enabled?: boolean;
  },
): Reminder {
  const existing = db
    .prepare('SELECT * FROM reminders WHERE owner_id = ?')
    .get(input.scheduleId) as ReminderRow | undefined;

  const offsetMinutes = input.offsetMinutes ?? null;
  const dayOffset = input.dayOffset ?? null;

  if ((offsetMinutes === null) === (dayOffset === null)) {
    throw new Error('提醒必须且只能设置「提前多少分钟」或「提前几天」之一');
  }

  if (existing) {
    db.prepare(
      'UPDATE reminders SET offset_minutes = ?, day_offset = ?, at_time = ?, enabled = ? WHERE id = ?',
    ).run(
      offsetMinutes,
      dayOffset,
      input.atTime ?? null,
      (input.enabled ?? existing.enabled === 1) ? 1 : 0,
      existing.id,
    );
    return listReminders(db, input.scheduleId)[0]!;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO reminders (id,owner_type,owner_id,offset_minutes,day_offset,at_time,enabled,last_fired_at)
     VALUES (?,'schedule',?,?,?,?,?,NULL)`,
  ).run(
    id,
    input.scheduleId,
    offsetMinutes,
    dayOffset,
    input.atTime ?? null,
    input.enabled === false ? 0 : 1,
  );
  return listReminders(db, input.scheduleId)[0]!;
}

export function deleteReminder(db: Db, scheduleId: string): void {
  db.prepare('DELETE FROM reminders WHERE owner_id = ?').run(scheduleId);
}

export function markFired(db: Db, reminderId: string, firedAt: string): void {
  db.prepare('UPDATE reminders SET last_fired_at = ? WHERE id = ?').run(firedAt, reminderId);
}

export interface DueReminder {
  reminder: Reminder;
  /** 该实例的原始开始时间（全天用 startAt，end_only 用 endAt） */
  occurrenceStart: string;
  /** 应该响的时刻 'YYYY-MM-DDTHH:mm:00' */
  fireAt: string;
  title: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function addMinutes(iso: string, minutes: number): string {
  const d = new Date(`${iso.slice(0, 19)}`);
  d.setMinutes(d.getMinutes() + minutes);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function fireTimeFor(
  reminder: Reminder,
  occurrence: { startAt: string | null; endAt: string | null; isAllDay: boolean },
): string | null {
  // 全天：提前 day_offset 天，固定 at_time（默认 09:00）
  if (occurrence.isAllDay) {
    const base = (occurrence.startAt ?? occurrence.endAt ?? '').slice(0, 10);
    if (!base) return null;
    const day = addDays(base, -(reminder.dayOffset ?? 0));
    return `${day}T${reminder.atTime ?? '09:00'}:00`;
  }

  // 有具体时刻：提前 offset_minutes 分钟
  const anchor = occurrence.startAt ?? occurrence.endAt;
  if (!anchor) return null;
  return addMinutes(anchor, -(reminder.offsetMinutes ?? 0));
}

/**
 * 此刻应该响的提醒。
 *
 * 判定链（FR-9.3）：提醒 enabled → 分类 remind_enabled → 才算。纯任务本来就不在 schedules 里，天然不参与。
 * 同一实例只响一次：`last_fired_at` 记的就是这次应该响的时刻。
 */
export function dueReminders(db: Db, now: string, windowMinutes = 1): DueReminder[] {
  const date = now.slice(0, 10);

  const rows = db
    .prepare(
      `SELECT r.*, c.remind_enabled AS cat_remind
       FROM reminders r
       JOIN schedules s ON s.id = r.owner_id
       JOIN categories c ON c.id = s.category_id
       WHERE r.enabled = 1 AND c.remind_enabled = 1`,
    )
    .all() as (ReminderRow & { cat_remind: number })[];

  const bySchedule = new Map(listSchedulesByRange(db, date, addDays(date, 2)).map((s) => [s.id, s]));
  const result: DueReminder[] = [];

  for (const row of rows) {
    const reminder = toReminder(row);
    const schedule = bySchedule.get(row.owner_id);
    if (!schedule) continue;

    const recurrence = getRecurrenceFor(db, schedule.recurrenceId);
    const occurrences = expandOccurrences(schedule, recurrence, date, addDays(date, 2));

    for (const occurrence of occurrences) {
      const fireAt = fireTimeFor(reminder, occurrence);
      if (!fireAt) continue;

      // 窗口：fireAt 落在 (now - window, now] 之间才算「这一刻」
      const ageMs = new Date(now).getTime() - new Date(fireAt).getTime();
      if (ageMs < 0 || ageMs > windowMinutes * 60_000) continue;
      if (reminder.lastFiredAt === fireAt) continue;

      result.push({
        reminder,
        occurrenceStart: occurrence.startAt ?? occurrence.endAt ?? '',
        fireAt,
        title: schedule.title,
      });
    }
  }

  return result;
}
