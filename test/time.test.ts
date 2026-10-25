import { describe, expect, it } from 'vitest';
import {
  addDays,
  datePart,
  isoWeekday,
  nowLocal,
  startOfWeek,
  timePart,
  withSeconds,
} from '../src/shared/time';

describe('time 工具', () => {
  it('nowLocal 是 19 字符的本地时间串', () => {
    expect(nowLocal()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it('addDays 跨月', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('addDays 处理闰年', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('datePart / timePart 拆解', () => {
    expect(datePart('2026-10-23T23:59:00')).toBe('2026-10-23');
    expect(timePart('2026-10-23T23:59:00')).toBe('23:59');
  });

  it('withSeconds 补秒但不重复补', () => {
    expect(withSeconds('08:00')).toBe('08:00:00');
    expect(withSeconds('08:00:00')).toBe('08:00:00');
  });

  it('isoWeekday 周一=1 周日=7', () => {
    expect(isoWeekday('2026-10-19')).toBe(1);
    expect(isoWeekday('2026-10-25')).toBe(7);
  });

  it('startOfWeek 取所在周的周一', () => {
    expect(startOfWeek('2026-10-23')).toBe('2026-10-19');
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19');
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19');
  });
});