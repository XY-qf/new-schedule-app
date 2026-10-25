import { beforeEach, describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/main/db/connection';
import { runMigrations } from '../src/main/db/migrate';
import { ensureSeedCategories } from '../src/main/repo/categories';
import { createSchedule } from '../src/main/repo/schedules';
import { createTask } from '../src/main/repo/tasks';
import { listTodoItems } from '../src/main/service/todo';
import { daysUntil, formatTimeInfo, sortTodoItems, type TodoItem } from '../src/shared/todo';
import type { Db } from '../src/main/db/driver';

let db: Db;

beforeEach(() => {
  db = openDatabase(join(tmpdir(), `ai-todo-todo-${randomUUID()}.db`));
  runMigrations(db);
  ensureSeedCategories(db);
});

const sched = (title: string, startAt: string, endAt: string, extra: Record<string, unknown> = {}) =>
  createSchedule(db, {
    title,
    categoryId: 'cat-course',
    timeType: 'range',
    isAllDay: false,
    startAt,
    endAt,
    isInTodo: true,
    ...extra,
  });

describe('待办列表 · 数据合并（T21）', () => {
  it('只收 is_in_todo 的日程', () => {
    sched('进去的', '2026-10-26T09:00:00', '2026-10-26T10:00:00');
    sched('不进去的', '2026-10-26T11:00:00', '2026-10-26T12:00:00', { isInTodo: false });

    const items = listTodoItems(db, { today: '2026-10-26' });
    expect(items.map((i) => i.title)).toEqual(['进去的']);
  });

  it('纯任务全部进来，即使没有分类', () => {
    createTask(db, { title: '买牛奶', note: null, categoryId: null });

    const items = listTodoItems(db, { today: '2026-10-26' });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'task', title: '买牛奶', categoryId: null });
  });

  it('排序：时间升序，纯任务永远最后', () => {
    sched('明天八点', '2026-10-27T08:00:00', '2026-10-27T09:00:00');
    sched('今天十四点', '2026-10-26T14:00:00', '2026-10-26T15:00:00');
    sched('今天九点', '2026-10-26T09:00:00', '2026-10-26T10:00:00');
    createTask(db, { title: '买牛奶', note: null, categoryId: null });

    const items = listTodoItems(db, { today: '2026-10-26' });
    expect(items.map((i) => i.title)).toEqual(['今天九点', '今天十四点', '明天八点', '买牛奶']);
  });

  it('已完成默认隐藏，includeDone 时排在最后', () => {
    const a = sched('已完成的', '2026-10-26T09:00:00', '2026-10-26T10:00:00');
    sched('未完成的', '2026-10-26T11:00:00', '2026-10-26T12:00:00', {});
    db.prepare('UPDATE schedules SET is_done = 1, done_at = ? WHERE id = ?').run('2026-10-26T08:00:00', a.id);

    expect(listTodoItems(db, { today: '2026-10-26' }).map((i) => i.title)).toEqual(['未完成的']);

    const all = listTodoItems(db, { today: '2026-10-26', includeDone: true });
    expect(all.map((i) => i.title)).toEqual(['未完成的', '已完成的']);
    expect(all[1]!.isDone).toBe(true);
  });

  it('按分类筛选', () => {
    sched('课程', '2026-10-26T09:00:00', '2026-10-26T10:00:00');
    sched('生活', '2026-10-26T11:00:00', '2026-10-26T12:00:00', { categoryId: 'cat-life' });
    createTask(db, { title: '无分类任务', note: null, categoryId: null });

    const onlyLife = listTodoItems(db, { today: '2026-10-26', categoryId: 'cat-life' });
    expect(onlyLife.map((i) => i.title)).toEqual(['生活']);
  });

  it('重复日程只显示最近的一次，不会把整个序列铺满', () => {
    createSchedule(db, {
      title: '每周的课',
      categoryId: 'cat-course',
      timeType: 'range',
      isAllDay: false,
      startAt: '2026-10-27T08:00:00',
      endAt: '2026-10-27T09:35:00',
      isInTodo: true,
      recurrence: { freq: 'weekly', byWeekday: [2] },
    });

    const items = listTodoItems(db, { today: '2026-10-26' });
    expect(items).toHaveLength(1);
    expect(items[0]!.occurrenceStart).toBe('2026-10-27T08:00:00');
  });

  it('带分类色与时间信息', () => {
    sched('课程', '2026-10-26T09:00:00', '2026-10-26T10:00:00');
    const item = listTodoItems(db, { today: '2026-10-26' })[0]!;
    expect(item.categoryColor).toBe('#4C8DFF');
    expect(formatTimeInfo(item)).toBe('09:00–10:00');
  });
});

describe('待办文案纯函数', () => {
  const base: TodoItem = {
    kind: 'schedule',
    key: 's1|2026-10-26T09:00:00',
    id: 's1',
    occurrenceStart: '2026-10-26T09:00:00',
    title: 'x',
    categoryId: 'cat-course',
    categoryColor: '#4C8DFF',
    timeType: 'range',
    startAt: '2026-10-26T14:00:00',
    endAt: '2026-10-26T15:30:00',
    isAllDay: false,
    isDone: false,
    note: null,
  };

  it('range 显示起止时刻', () => {
    expect(formatTimeInfo(base)).toBe('14:00–15:30');
  });

  it('start_only 显示「开始」', () => {
    expect(formatTimeInfo({ ...base, timeType: 'start_only', endAt: null })).toBe('14:00 开始');
  });

  it('end_only 显示「截止」', () => {
    expect(formatTimeInfo({ ...base, timeType: 'end_only', startAt: null, endAt: '2026-10-26T15:30:00' })).toBe(
      '截止 15:30',
    );
  });

  it('全天日程显示「全天」', () => {
    expect(formatTimeInfo({ ...base, isAllDay: true })).toBe('全天');
  });

  it('纯任务显示备注或留空', () => {
    expect(
      formatTimeInfo({ ...base, kind: 'task', timeType: 'task', startAt: null, endAt: null, note: '记得买两盒' }),
    ).toBe('记得买两盒');
    expect(
      formatTimeInfo({ ...base, kind: 'task', timeType: 'task', startAt: null, endAt: null, note: null }),
    ).toBe('');
  });

  it('daysUntil 按本地日历日计算', () => {
    expect(daysUntil('2026-10-26', '2026-10-26')).toBe(0);
    expect(daysUntil('2026-10-27', '2026-10-26')).toBe(1);
    expect(daysUntil('2026-10-25', '2026-10-26')).toBe(-1);
    expect(daysUntil('2028-03-01', '2028-02-28')).toBe(2);
  });

  it('sortTodoItems 纯任务排最后', () => {
    const task: TodoItem = { ...base, kind: 'task', timeType: 'task', startAt: null, endAt: null, id: 't1', key: 't1' };
    const late: TodoItem = { ...base, id: 's2', key: 's2', startAt: '2030-01-01T09:00:00' };
    expect(sortTodoItems([task, late]).map((i) => i.id)).toEqual(['s2', 't1']);
  });
});
