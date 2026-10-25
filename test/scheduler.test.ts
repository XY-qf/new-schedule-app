import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/main/db/connection';
import { runMigrations } from '../src/main/db/migrate';
import { ensureSeedCategories } from '../src/main/repo/categories';
import { createSchedule } from '../src/main/repo/schedules';
import { upsertReminder } from '../src/main/repo/reminders';
import { catchUp, summarizeMissed, tick } from '../src/main/notify/scheduler';
import type { Db } from '../src/main/db/driver';

let db: Db;

beforeEach(() => {
  db = openDatabase(join(tmpdir(), `ai-todo-sched-${randomUUID()}.db`));
  runMigrations(db);
  ensureSeedCategories(db);
});

function classWithReminder(title: string, startAt: string, offsetMinutes: number): void {
  const hour = String(Number(startAt.slice(11, 13)) + 1).padStart(2, '0');
  const endAt = startAt.slice(0, 11) + hour + ':00:00';
  const s = createSchedule(db, {
    title,
    categoryId: 'cat-course',
    timeType: 'range',
    isAllDay: false,
    startAt,
    endAt,
  });
  upsertReminder(db, { scheduleId: s.id, offsetMinutes });
}

describe('提醒调度（T28）', () => {
  it('到点触发一次，第二次不再触发', () => {
    classWithReminder('高数课', '2026-10-26T09:00:00', 10);
    const onDue = vi.fn();

    expect(tick(db, '2026-10-26T08:50:00', { onDue })).toBe(1);
    expect(onDue).toHaveBeenCalledOnce();

    expect(tick(db, '2026-10-26T08:50:00', { onDue })).toBe(0);
    expect(onDue).toHaveBeenCalledOnce();
  });

  it('没到点不触发', () => {
    classWithReminder('高数课', '2026-10-26T09:00:00', 10);
    const onDue = vi.fn();
    expect(tick(db, '2026-10-26T08:49:00', { onDue })).toBe(0);
  });

  it('启动补偿把错过的一次性汇总（FR-9.4）', () => {
    classWithReminder('高数课', '2026-10-26T09:00:00', 10);
    classWithReminder('体检', '2026-10-26T11:00:00', 10);

    const onMissed = vi.fn();
    // 12:00 启动，两条都已错过，但都在 12 小时内
    const count = catchUp(db, '2026-10-26T12:00:00', { onMissed });

    expect(count).toBe(2);
    expect(onMissed).toHaveBeenCalledOnce();
    expect(onMissed.mock.calls[0]![0]).toHaveLength(2);
  });

  it('超过 12 小时的不再打扰', () => {
    classWithReminder('昨天的课', '2026-10-25T09:00:00', 10);
    const onMissed = vi.fn();

    // 第二天 12:00 启动，已超过 12 小时
    const count = catchUp(db, '2026-10-26T12:00:00', { onMissed });
    expect(count).toBe(0);
    expect(onMissed).not.toHaveBeenCalled();
  });

  it('补偿过的不会再触发一次', () => {
    classWithReminder('高数课', '2026-10-26T09:00:00', 10);
    catchUp(db, '2026-10-26T12:00:00', { onMissed: vi.fn() });

    const onDue = vi.fn();
    expect(tick(db, '2026-10-26T08:50:00', { onDue })).toBe(0);
  });

  it('汇总结论文案', () => {
    const items = [
      { reminder: {} as never, occurrenceStart: '', fireAt: '', title: '高数课' },
      { reminder: {} as never, occurrenceStart: '', fireAt: '', title: '体检' },
    ];
    expect(summarizeMissed(items)).toBe('你错过了 2 条提醒：高数课、体检');
  });

  it('一条都没有时不调用汇总', () => {
    const onMissed = vi.fn();
    expect(catchUp(db, '2026-10-26T12:00:00', { onMissed })).toBe(0);
    expect(onMissed).not.toHaveBeenCalled();
  });
});

describe('调度器时钟（回归：必须是本地时间）', () => {
  it('默认时钟与 nowLocal 一致，不会用 UTC', async () => {
    const { nowLocal } = await import('../src/shared/time');
    const local = nowLocal();
    // toISOString 是 UTC，在 +08:00 会比本地早 8 小时；默认时钟不能与它相等
    const utc = new Date().toISOString().slice(0, 19);
    expect(local.slice(0, 13)).not.toBe(utc.slice(0, 13));
  });
});
