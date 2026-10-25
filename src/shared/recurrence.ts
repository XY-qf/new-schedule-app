import type { Occurrence, Schedule } from './types';
import { addDays, datePart } from './time';

export interface Recurrence {
  id: string;
  freq: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'weekdays' | 'custom';
  interval: number | null;
  /** 1 = 周一 … 7 = 周日 */
  byWeekday: number[] | null;
  byMonthday: number | null;
  /** 'YYYY-MM-DD'，含当天 */
  untilDate: string | null;
}

/** 单次展开最多跨多少天，防止调用方传入超大区间时卡死。 */
const MAX_SPAN_DAYS = 800;

function toUTC(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function daysBetween(from: string, to: string): number {
  return Math.round((toUTC(to) - toUTC(from)) / 86_400_000);
}

/** 1 = 周一 … 7 = 周日 */
function isoWeekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return js === 0 ? 7 : js;
}

function startOfIsoWeek(date: string): string {
  return addDays(date, -(isoWeekday(date) - 1));
}

function monthIndex(date: string): number {
  const [y, m] = date.split('-').map(Number) as [number, number];
  return y * 12 + (m - 1);
}

/**
 * 把一条日程按重复规则展开成落在 [rangeStart, rangeEnd] 内的实例。
 *
 * 全程用「年月日」整数比对，不在循环里做 Date 的时区加减——
 * 否则 23:59 这类边界会漂一天（见计划 Review Focus 第 1、2 条）。
 */
export function expandOccurrences(
  schedule: Schedule,
  recurrence: Recurrence | null,
  rangeStart: string,
  rangeEnd: string,
): Occurrence[] {
  const anchorFull = schedule.startAt ?? schedule.endAt;
  if (!anchorFull) return [];

  const anchorDate = datePart(anchorFull);
  const endFull = schedule.endAt;
  const endOffsetDays =
    endFull && schedule.startAt ? daysBetween(anchorDate, datePart(endFull)) : 0;

  const make = (date: string): Occurrence => ({
    scheduleId: schedule.id,
    startAt: schedule.startAt ? `${date}T${schedule.startAt.slice(11)}` : null,
    endAt: endFull ? `${addDays(date, endOffsetDays)}T${endFull.slice(11)}` : null,
    isAllDay: schedule.isAllDay,
  });

  if (!recurrence) {
    // 区间相交，不是「锚点落在窗口内」：跨天日程的锚点可能早于窗口（审查 Critical 1）。
    const endDate = addDays(anchorDate, endOffsetDays);
    if (endDate < rangeStart || anchorDate > rangeEnd) return [];
    return [make(anchorDate)];
  }

  const matches = (date: string): boolean => {
    const dayDiff = daysBetween(anchorDate, date);
    if (dayDiff < 0) return false;

    switch (recurrence.freq) {
      case 'daily':
        return dayDiff % (recurrence.interval ?? 1) === 0;

      case 'custom':
        return dayDiff % Math.max(recurrence.interval ?? 1, 1) === 0;

      case 'weekdays':
        return isoWeekday(date) <= 5 && dayDiff % (recurrence.interval ?? 1) === 0;

      case 'weekly':
      case 'biweekly': {
        const step = recurrence.freq === 'biweekly' ? 2 : (recurrence.interval ?? 1);
        const weekDiff = daysBetween(startOfIsoWeek(anchorDate), startOfIsoWeek(date)) / 7;
        if (weekDiff % step !== 0) return false;
        const weekdays = recurrence.byWeekday?.length
          ? recurrence.byWeekday
          : [isoWeekday(anchorDate)];
        return weekdays.includes(isoWeekday(date));
      }

      case 'monthly': {
        const targetDay = recurrence.byMonthday ?? Number(anchorDate.slice(8, 10));
        const day = Number(date.slice(8, 10));
        if (day !== targetDay) return false;
        return (monthIndex(date) - monthIndex(anchorDate)) % (recurrence.interval ?? 1) === 0;
      }

      default:
        return false;
    }
  };

  const from = anchorDate < rangeStart ? rangeStart : anchorDate;
  const limit =
    recurrence.untilDate && recurrence.untilDate < rangeEnd ? recurrence.untilDate : rangeEnd;

  const out: Occurrence[] = [];
  let cursor = from;
  for (let i = 0; i <= MAX_SPAN_DAYS && cursor <= limit; i += 1) {
    if (matches(cursor)) out.push(make(cursor));
    cursor = addDays(cursor, 1);
  }
  return out;
}
/** 界面上的重复规则草稿；提交时由主进程落成 recurrences 行。 */
export interface RecurrenceDraft {
  freq: Recurrence['freq'];
  interval?: number | null;
  byWeekday?: number[] | null;
  byMonthday?: number | null;
  untilDate?: string | null;
}

const WEEKDAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'];

const FREQ_LABEL: Record<Recurrence['freq'], string> = {
  daily: '每天',
  weekly: '每周',
  biweekly: '每两周',
  monthly: '每月',
  weekdays: '工作日',
  custom: '自定义',
};

/** 给界面用的一句话摘要，例如「每周 二、四，直到 2027-01-15」。 */
export function describeRecurrence(rule: RecurrenceDraft | Recurrence | null): string {
  if (!rule) return '不重复';

  let text = FREQ_LABEL[rule.freq] ?? '不重复';

  if (rule.freq === 'weekly' || rule.freq === 'custom') {
    const days = rule.byWeekday ?? [];
    if (days.length > 0) {
      text += ` ${days
        .slice()
        .sort((a, b) => a - b)
        .map((d) => WEEKDAY_NAMES[d - 1])
        .join('、')}`;
    }
  }

  if (rule.freq === 'monthly' && rule.byMonthday) {
    text += ` ${rule.byMonthday} 日`;
  }

  if (rule.untilDate) {
    text += `，直到 ${rule.untilDate}`;
  }

  return text;
}
