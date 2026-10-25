import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../src/main/db/connection';
import { runMigrations } from '../src/main/db/migrate';
import { ensureSeedCategories } from '../src/main/repo/categories';
import { createSchedule, updateSchedule } from '../src/main/repo/schedules';
import { listExceptions, upsertException } from '../src/main/repo/exceptions';
import { listOccurrenceViews } from '../src/main/service/calendar';
import type { Db } from '../src/main/db/driver';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

let db: Db;

function fresh(): Db {
  const file = join(tmpdir(), `ai-todo-exc-${randomUUID()}.db`);
  const database = openDatabase(file);
  runMigrations(database);
  ensureSeedCategories(database);
  return database;
}

beforeEach(() => {
  db = fresh();
});

/** 每周二、四 08:00–09:35 的课 */
function weeklyClass(): ReturnType<typeof createSchedule> {
  return createSchedule(db, {
    title: '高等数学',
    categoryId: 'cat-course',
    timeType: 'range',
    isAllDay: false,
    startAt: '2026-10-20T08:00:00',
    endAt: '2026-10-20T09:35:00',
    recurrence: { freq: 'weekly', byWeekday: [2, 4] },
  });
}

describe('单次例外（T18）', () => {
  it('改这一次的标题，只有那一天变', () => {
    const s = weeklyClass();

    upsertException(db, {
      scheduleId: s.id,
      occurrenceStart: '2026-10-22T08:00:00',
      override: { title: '高数（调课）' },
    });

    const views = listOccurrenceViews(db, '2026-10-19', '2026-10-25');
    const thursday = views.find((v) => v.startAt === '2026-10-22T08:00:00');
    const tuesday = views.find((v) => v.startAt === '2026-10-20T08:00:00');

    expect(thursday?.title).toBe('高数（调课）');
    expect(tuesday?.title).toBe('高等数学');
  });

  it('删这一次，只有那一天消失', () => {
    const s = weeklyClass();

    upsertException(db, { scheduleId: s.id, occurrenceStart: '2026-10-22T08:00:00', isDeleted: true });

    const views = listOccurrenceViews(db, '2026-10-19', '2026-10-25');
    expect(views.map((v) => v.startAt)).toEqual(['2026-10-20T08:00:00']);
  });

  it('改过时间的实例再次编辑，仍然命中同一条例外（身份键是原始时间）', () => {
    const s = weeklyClass();

    upsertException(db, {
      scheduleId: s.id,
      occurrenceStart: '2026-10-22T08:00:00',
      override: { title: '第一次改' },
    });
    // 第二次编辑：仍然用原始 occurrenceStart
    upsertException(db, {
      scheduleId: s.id,
      occurrenceStart: '2026-10-22T08:00:00',
      override: { title: '第二次改' },
    });

    const rows = listExceptions(db, '2026-10-19', '2026-10-25');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.override?.title).toBe('第二次改');
  });

  it('把这一次挪到别的时间，原时间不再出现', () => {
    const s = weeklyClass();

    upsertException(db, {
      scheduleId: s.id,
      occurrenceStart: '2026-10-22T08:00:00',
      override: { startAt: '2026-10-22T14:00:00', endAt: '2026-10-22T15:35:00' },
    });

    const views = listOccurrenceViews(db, '2026-10-19', '2026-10-25');
    expect(views.map((v) => v.startAt)).toEqual(['2026-10-20T08:00:00', '2026-10-22T14:00:00']);
  });

  it('单次完成只影响那一次', () => {
    const s = weeklyClass();

    upsertException(db, { scheduleId: s.id, occurrenceStart: '2026-10-20T08:00:00', isDone: true });

    const views = listOccurrenceViews(db, '2026-10-19', '2026-10-25');
    expect(views.find((v) => v.startAt === '2026-10-20T08:00:00')?.isDone).toBe(true);
    expect(views.find((v) => v.startAt === '2026-10-22T08:00:00')?.isDone).toBe(false);
  });

  it('改整个序列走 updateSchedule，所有实例都变', () => {
    const s = weeklyClass();
    updateSchedule(db, s.id, { title: '高等数学（新）' });

    const views = listOccurrenceViews(db, '2026-10-19', '2026-10-25');
    expect(views.every((v) => v.title === '高等数学（新）')).toBe(true);
  });

  it('删除整个序列后所有实例消失', () => {
    const s = weeklyClass();
    db.prepare('DELETE FROM schedules WHERE id = ?').run(s.id);

    expect(listOccurrenceViews(db, '2026-10-19', '2026-10-25')).toHaveLength(0);
  });
});
