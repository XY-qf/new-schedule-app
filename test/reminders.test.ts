import { beforeEach, describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/main/db/connection';
import { runMigrations } from '../src/main/db/migrate';
import { ensureSeedCategories } from '../src/main/repo/categories';
import { createSchedule, deleteSchedule } from '../src/main/repo/schedules';
import {
  deleteReminder,
  dueReminders,
  listReminders,
  markFired,
  upsertReminder,
} from '../src/main/repo/reminders';
import type { Db } from '../src/main/db/driver';

let db: Db;

beforeEach(() => {
  db = openDatabase(join(tmpdir(), `ai-todo-rem-${randomUUID()}.db`));
  runMigrations(db);
  ensureSeedCategories(db);
});

const classAt = (start = '2026-10-26T09:00:00', end = '2026-10-26T10:00:00', extra = {}) =>
  createSchedule(db, {
    title: '高数课',
    categoryId: 'cat-course',
    timeType: 'range',
    isAllDay: false,
    startAt: start,
    endAt: end,
    ...extra,
  });

describe('提醒数据层（T27）', () => {
  it('提前 10 分钟：08:50 该响', () => {
    const s = classAt();
    upsertReminder(db, { scheduleId: s.id, offsetMinutes: 10 });

    const due = dueReminders(db, '2026-10-26T08:50:00');
    expect(due).toHaveLength(1);
    expect(due[0]!.title).toBe('高数课');
    expect(due[0]!.fireAt).toBe('2026-10-26T08:50:00');
  });

  it('没到点不响', () => {
    const s = classAt();
    upsertReminder(db, { scheduleId: s.id, offsetMinutes: 10 });
    expect(dueReminders(db, '2026-10-26T08:40:00')).toHaveLength(0);
  });

  it('关掉提醒（enabled=0）不响', () => {
    const s = classAt();
    upsertReminder(db, { scheduleId: s.id, offsetMinutes: 10, enabled: false });
    expect(dueReminders(db, '2026-10-26T08:50:00')).toHaveLength(0);
  });

  it('分类关掉提醒（remind_enabled=0）也不响（FR-9.3）', () => {
    const s = classAt();
    upsertReminder(db, { scheduleId: s.id, offsetMinutes: 10 });
    db.prepare("UPDATE categories SET remind_enabled = 0 WHERE id = 'cat-course'").run();

    expect(dueReminders(db, '2026-10-26T08:50:00')).toHaveLength(0);
  });

  it('同一个实例只响一次', () => {
    const s = classAt();
    const r = upsertReminder(db, { scheduleId: s.id, offsetMinutes: 10 });

    const first = dueReminders(db, '2026-10-26T08:50:00');
    expect(first).toHaveLength(1);

    markFired(db, r.id, first[0]!.fireAt);
    expect(dueReminders(db, '2026-10-26T08:50:00')).toHaveLength(0);
  });

  it('全天日程按「提前一天 + 09:00」响', () => {
    const s = createSchedule(db, {
      title: '体检',
      categoryId: 'cat-life',
      timeType: 'range',
      isAllDay: true,
      startAt: '2026-10-26T00:00:00',
      endAt: null,
    });
    upsertReminder(db, { scheduleId: s.id, dayOffset: 1, atTime: '09:00' });

    expect(dueReminders(db, '2026-10-25T09:00:00')).toHaveLength(1);
  });

  it('重复日程的本周实例也能响', () => {
    const s = createSchedule(db, {
      title: '每周的课',
      categoryId: 'cat-course',
      timeType: 'range',
      isAllDay: false,
      startAt: '2026-10-20T09:00:00',
      endAt: '2026-10-20T10:00:00',
      recurrence: { freq: 'weekly', byWeekday: [2] },
    });
    upsertReminder(db, { scheduleId: s.id, offsetMinutes: 5 });

    // 2026-10-27 是下周二
    expect(dueReminders(db, '2026-10-27T08:55:00')).toHaveLength(1);
  });

  it('一条日程只有一条提醒，重复设置是覆盖', () => {
    const s = classAt();
    upsertReminder(db, { scheduleId: s.id, offsetMinutes: 10 });
    upsertReminder(db, { scheduleId: s.id, offsetMinutes: 30 });

    const all = listReminders(db, s.id);
    expect(all).toHaveLength(1);
    expect(all[0]!.offsetMinutes).toBe(30);
  });

  it('offset 与 dayOffset 同时给会报错', () => {
    const s = classAt();
    expect(() =>
      upsertReminder(db, { scheduleId: s.id, offsetMinutes: 10, dayOffset: 1 }),
    ).toThrow(/只能设置/);
  });

  it('日程删除后提醒跟着没了（外键级联）', () => {
    const s = classAt();
    upsertReminder(db, { scheduleId: s.id, offsetMinutes: 10 });
    deleteSchedule(db, s.id);

    expect(listReminders(db, s.id)).toHaveLength(0);
  });

  it('删除提醒', () => {
    const s = classAt();
    upsertReminder(db, { scheduleId: s.id, offsetMinutes: 10 });
    deleteReminder(db, s.id);
    expect(listReminders(db, s.id)).toHaveLength(0);
  });
});
