import { beforeEach, describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/main/db/connection';
import { runMigrations } from '../src/main/db/migrate';
import { listPeriods, periodToTimeRange, replacePeriods } from '../src/main/repo/periods';
import type { Db } from '../src/main/db/driver';

let db: Db;

beforeEach(() => {
  db = openDatabase(join(tmpdir(), `ai-todo-period-${randomUUID()}.db`));
  runMigrations(db);
});

describe('作息时间表（T19）', () => {
  it('迁移种入 12 节，按节次升序', () => {
    const periods = listPeriods(db);
    expect(periods).toHaveLength(12);
    expect(periods[0]!.no).toBe(1);
    expect(periods[11]!.no).toBe(12);
  });

  it('第 1 节是 08:00–08:45，第 2 节接在后面', () => {
    const periods = listPeriods(db);
    expect(periods[0]).toMatchObject({ label: '第 1 节', startTime: '08:00', endTime: '08:45' });
    expect(periods[1]).toMatchObject({ startTime: '08:50', endTime: '09:35' });
  });

  it('「第 1–2 节」正好是 08:00–09:35（与 PRD FR-4.4 的例子一致）', () => {
    const range = periodToTimeRange(listPeriods(db), 1, 2);
    expect(range).toEqual({ startTime: '08:00', endTime: '09:35' });
  });

  it('单节也能换算', () => {
    expect(periodToTimeRange(listPeriods(db), 3)).toEqual({
      startTime: '10:00',
      endTime: '10:45',
    });
  });

  it('节次越界返回 null，而不是给半截时间', () => {
    const periods = listPeriods(db);
    expect(periodToTimeRange(periods, 0)).toBeNull();
    expect(periodToTimeRange(periods, 13)).toBeNull();
    expect(periodToTimeRange(periods, 5, 3)).toBeNull();
  });

  it('改作息表后换算结果跟着变（FR-3.5 的基础）', () => {
    replacePeriods(db, [
      { no: 1, label: '第 1 节', startTime: '09:00', endTime: '09:45' },
      { no: 2, label: '第 2 节', startTime: '09:55', endTime: '10:40' },
    ]);

    expect(periodToTimeRange(listPeriods(db), 1, 2)).toEqual({
      startTime: '09:00',
      endTime: '10:40',
    });
  });

  it('空表时列表是空数组而不是抛错', () => {
    replacePeriods(db, []);
    expect(listPeriods(db)).toEqual([]);
  });
});
