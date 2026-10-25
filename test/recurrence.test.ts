import { describe, expect, it } from 'vitest';
import { expandOccurrences, type Recurrence } from '../src/shared/recurrence';
import type { Schedule } from '../src/shared/types';

const sched: Schedule = {
  id: 's1',
  title: '高数',
  categoryId: 'cat-course',
  timeType: 'range',
  isAllDay: false,
  startAt: '2026-09-01T08:00:00',
  endAt: '2026-09-01T09:35:00',
  recurrenceId: null,
  periodStart: null,
  periodEnd: null,
  sortHint: null,
  location: null,
  note: null,
  isInTodo: false,
  isDone: false,
  doneAt: null,
  createdAt: 't',
  updatedAt: 't',
};

const rec = (patch: Partial<Recurrence>): Recurrence => ({
  id: 'r1',
  freq: 'weekly',
  interval: null,
  byWeekday: null,
  byMonthday: null,
  untilDate: null,
  ...patch,
});

const dates = (out: { startAt: string | null }[]) => out.map((o) => o.startAt!.slice(0, 10));

describe('expandOccurrences', () => {
  it('无重复规则时只返回自身（在范围内）', () => {
    const out = expandOccurrences(sched, null, '2026-09-01', '2026-09-07');
    expect(out).toHaveLength(1);
    expect(out[0]!.startAt).toBe('2026-09-01T08:00:00');
  });

  it('无重复规则且在范围外时返回空', () => {
    expect(expandOccurrences(sched, null, '2026-10-01', '2026-10-31')).toHaveLength(0);
  });

  it('每周二四，九月内展开 9 次', () => {
    const out = expandOccurrences(sched, rec({ freq: 'weekly', byWeekday: [2, 4] }), '2026-09-01', '2026-09-30');
    expect(out).toHaveLength(9);
    expect(out[0]!.startAt).toBe('2026-09-01T08:00:00');
    expect(out.at(-1)!.startAt).toBe('2026-09-29T08:00:00');
  });

  it('每两周只取隔周', () => {
    const out = expandOccurrences(sched, rec({ freq: 'biweekly', byWeekday: [2] }), '2026-09-01', '2026-09-30');
    expect(dates(out)).toEqual(['2026-09-01', '2026-09-15', '2026-09-29']);
  });

  it('untilDate 当天包含在内', () => {
    const out = expandOccurrences(sched, rec({ freq: 'daily', untilDate: '2026-09-03' }), '2026-09-01', '2026-09-30');
    expect(out).toHaveLength(3);
  });

  it('每月 31 日在没有 31 号的月份跳过', () => {
    const s31: Schedule = { ...sched, startAt: '2026-01-31T08:00:00', endAt: '2026-01-31T09:00:00' };
    const out = expandOccurrences(s31, rec({ freq: 'monthly', byMonthday: 31 }), '2026-02-01', '2026-04-30');
    expect(dates(out)).toEqual(['2026-03-31']);
  });

  it('平年 2 月没有 29 号时跳过', () => {
    const s29: Schedule = { ...sched, startAt: '2027-01-29T08:00:00', endAt: '2027-01-29T09:00:00' };
    const out = expandOccurrences(s29, rec({ freq: 'monthly', byMonthday: 29 }), '2027-02-01', '2027-02-28');
    expect(out).toHaveLength(0);
  });

  it('按工作日只取周一到周五', () => {
    const out = expandOccurrences(sched, rec({ freq: 'weekdays' }), '2026-09-01', '2026-09-07');
    // 9/1 周二 ~ 9/7 周一，其中 9/5 周六、9/6 周日不取
    expect(dates(out)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-07']);
  });

  it('跨越范围裁剪：只返回落在范围内的实例', () => {
    const out = expandOccurrences(sched, rec({ freq: 'daily' }), '2026-09-10', '2026-09-12');
    expect(dates(out)).toEqual(['2026-09-10', '2026-09-11', '2026-09-12']);
  });

  it('实例保留原来的时刻与时长', () => {
    const out = expandOccurrences(sched, rec({ freq: 'daily' }), '2026-09-02', '2026-09-02');
    expect(out[0]!.startAt).toBe('2026-09-02T08:00:00');
    expect(out[0]!.endAt).toBe('2026-09-02T09:35:00');
  });

  it('不会产生早于锚点的实例', () => {
    const out = expandOccurrences(sched, rec({ freq: 'daily' }), '2026-08-01', '2026-08-31');
    expect(out).toHaveLength(0);
  });
});
