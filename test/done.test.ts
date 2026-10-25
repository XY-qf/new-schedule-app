import { beforeEach, describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/main/db/connection';
import { runMigrations } from '../src/main/db/migrate';
import { ensureSeedCategories } from '../src/main/repo/categories';
import { createSchedule, getSchedule, setScheduleDone } from '../src/main/repo/schedules';
import { createTask, getTask, setTaskDone } from '../src/main/repo/tasks';
import { listOccurrenceViews } from '../src/main/service/calendar';
import type { Db } from '../src/main/db/driver';

let db: Db;

beforeEach(() => {
  db = openDatabase(join(tmpdir(), `ai-todo-done-${randomUUID()}.db`));
  runMigrations(db);
  ensureSeedCategories(db);
});

const single = () =>
  createSchedule(db, {
    title: '单次',
    categoryId: 'cat-course',
    timeType: 'range',
    isAllDay: false,
    startAt: '2026-10-26T09:00:00',
    endAt: '2026-10-26T10:00:00',
  });

const weekly = () =>
  createSchedule(db, {
    title: '每周的课',
    categoryId: 'cat-course',
    timeType: 'range',
    isAllDay: false,
    startAt: '2026-10-20T08:00:00',
    endAt: '2026-10-20T09:35:00',
    recurrence: { freq: 'weekly', byWeekday: [2, 4] },
  });

describe('完成态（T23）', () => {
  it('单次日程完成后 is_done=1 且 done_at 有值', () => {
    const s = single();
    setScheduleDone(db, s.id, true);

    const after = getSchedule(db, s.id);
    expect(after.isDone).toBe(true);
    expect(after.doneAt).not.toBeNull();
  });

  it('单次日程可以取消完成', () => {
    const s = single();
    setScheduleDone(db, s.id, true);
    setScheduleDone(db, s.id, false);

    const after = getSchedule(db, s.id);
    expect(after.isDone).toBe(false);
    expect(after.doneAt).toBeNull();
  });

  it('重复日程完成某一次时，只写例外，不改整行', () => {
    const s = weekly();
    setScheduleDone(db, s.id, true, '2026-10-22T08:00:00');

    // 整行必须还是未完成
    expect(getSchedule(db, s.id).isDone).toBe(false);

    const row = db
      .prepare('SELECT is_done FROM schedule_exceptions WHERE schedule_id = ?')
      .get(s.id) as { is_done: number };
    expect(row.is_done).toBe(1);
  });

  it('重复日程完成一次后，只有那一天变已完成', () => {
    const s = weekly();
    setScheduleDone(db, s.id, true, '2026-10-22T08:00:00');

    const views = listOccurrenceViews(db, '2026-10-19', '2026-10-25');
    expect(views.find((v) => v.startAt === '2026-10-22T08:00:00')?.isDone).toBe(true);
    expect(views.find((v) => v.startAt === '2026-10-20T08:00:00')?.isDone).toBe(false);
  });

  it('纯任务可以完成与取消', () => {
    const t = createTask(db, { title: '买牛奶', categoryId: null, note: null });

    expect(getTask(db, setTaskDone(db, t.id, true).id).isDone).toBe(true);
    expect(getTask(db, setTaskDone(db, t.id, false).id).isDone).toBe(false);
  });

  it('任务完成时 done_at 必须同时写入（DDL 有 CHECK）', () => {
    const t = createTask(db, { title: '买牛奶', categoryId: null, note: null });
    setTaskDone(db, t.id, true);

    const after = getTask(db, t.id);
    expect(after.doneAt).not.toBeNull();
  });
});
