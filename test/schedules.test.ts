import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from '../src/main/db/connection';
import { runMigrations } from '../src/main/db/migrate';
import { ensureSeedCategories } from '../src/main/repo/categories';
import {
  createSchedule,
  deleteSchedule,
  listSchedulesByRange,
  updateSchedule,
  type ScheduleInput,
} from '../src/main/repo/schedules';

let db: Db;

beforeEach(() => {
  db = openDatabase(':memory:');
  runMigrations(db);
  ensureSeedCategories(db);
});

const base: ScheduleInput = {
  title: '高数',
  categoryId: 'cat-course',
  timeType: 'range',
  isAllDay: false,
  startAt: '2026-10-19T08:00:00',
  endAt: '2026-10-19T09:35:00',
};

const WEEK = ['2026-10-19', '2026-10-25'] as const;

describe('日程仓储 · 基础 CRUD', () => {
  it('创建后可按范围读回', () => {
    createSchedule(db, base);
    const rows = listSchedulesByRange(db, ...WEEK);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe('高数');
  });

  it('范围外的日程不会被读回', () => {
    createSchedule(db, base);
    expect(listSchedulesByRange(db, '2026-10-26', '2026-11-01')).toHaveLength(0);
  });

  it('标题里的 SQL 特殊字符被当作普通文本', () => {
    const evil = "'; DROP TABLE schedules; --";
    createSchedule(db, { ...base, title: evil });
    expect(listSchedulesByRange(db, ...WEEK)[0]!.title).toBe(evil);
    expect(db.prepare('SELECT COUNT(*) c FROM schedules').get()).toEqual({ c: 1 });
  });

  it('更新标题与结束时间', () => {
    const s = createSchedule(db, base);
    const r = updateSchedule(db, s.id, { title: '高数(补)', endAt: '2026-10-19T10:00:00' });
    expect(r.title).toBe('高数(补)');
    expect(r.endAt).toBe('2026-10-19T10:00:00');
  });

  it('删除后读不到', () => {
    const s = createSchedule(db, base);
    deleteSchedule(db, s.id);
    expect(listSchedulesByRange(db, ...WEEK)).toHaveLength(0);
  });

  it('结束早于开始被拒绝', () => {
    expect(() => createSchedule(db, { ...base, endAt: '2026-10-19T07:00:00' })).toThrow();
  });
});

describe('日程仓储 · 范围查询的两个坑（契约审查 C1/C2）', () => {
  it('锚点在 9 月的每周重复日程，查 10 月能读回（C1）', () => {
    db.exec("INSERT INTO recurrences (id,freq,by_weekday) VALUES ('r1','weekly','2')");
    createSchedule(db, {
      ...base,
      title: '每周二英语',
      startAt: '2026-09-01T08:00:00',
      endAt: '2026-09-01T09:35:00',
      recurrenceId: 'r1',
    });

    const rows = listSchedulesByRange(db, '2026-10-01', '2026-10-31');
    expect(rows.map((r) => r.title)).toContain('每周二英语');
  });

  it('已过重复结束日期的日程不再被读回（C1）', () => {
    db.exec("INSERT INTO recurrences (id,freq,by_weekday,until_date) VALUES ('r1','weekly','2','2026-09-30')");
    createSchedule(db, {
      ...base,
      startAt: '2026-09-01T08:00:00',
      endAt: '2026-09-01T09:35:00',
      recurrenceId: 'r1',
    });

    expect(listSchedulesByRange(db, '2026-10-01', '2026-10-31')).toHaveLength(0);
  });

  it('只有结束时间的日程能被读回，且排序不压在最前（C2）', () => {
    createSchedule(db, base); // 10-19 08:00
    createSchedule(db, {
      ...base,
      title: '交实验报告',
      timeType: 'end_only',
      startAt: null,
      endAt: '2026-10-23T23:59:00',
    });

    const rows = listSchedulesByRange(db, ...WEEK);
    expect(rows.map((r) => r.title)).toEqual(['高数', '交实验报告']);
  });

  it('跨天全天日程：开始日早于窗口也能读回（C2）', () => {
    createSchedule(db, {
      ...base,
      title: '三天旅行',
      isAllDay: true,
      timeType: 'range',
      startAt: '2026-10-18T00:00:00',
      endAt: '2026-10-20T00:00:00',
    });

    const rows = listSchedulesByRange(db, ...WEEK);
    expect(rows.map((r) => r.title)).toEqual(['三天旅行']);
  });

  it('时间点落在窗口最后一刻仍算可见', () => {
    createSchedule(db, {
      ...base,
      title: '周日深夜',
      timeType: 'end_only',
      startAt: null,
      endAt: '2026-10-25T23:59:00',
    });

    expect(listSchedulesByRange(db, ...WEEK)).toHaveLength(1);
  });
});

describe('日程仓储 · 重复的只有结束时间（审查 Critical 1）', () => {
  it('start_at 为空的重复日程能被取回', () => {
    db.exec("INSERT INTO recurrences (id,freq) VALUES ('r2','weekly')");
    createSchedule(db, {
      title: '每周截止提醒',
      categoryId: 'cat-course',
      timeType: 'end_only',
      isAllDay: false,
      startAt: null,
      endAt: '2026-09-02T23:59:00',
      recurrenceId: 'r2',
    });

    const rows = listSchedulesByRange(db, '2026-10-19', '2026-10-25');
    expect(rows.map((r) => r.title)).toEqual(['每周截止提醒']);
  });
});
