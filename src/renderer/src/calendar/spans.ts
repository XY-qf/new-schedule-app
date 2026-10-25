import type { OccurrenceView } from '../../../shared/types';
import { datePart } from '../../../shared/time';
import type { DayItem } from './DayColumn';

export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;

export function minutesOf(iso: string): number {
  return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
}

export function timeLabel(iso: string): string {
  return iso.slice(11, 16);
}

export interface Span {
  startDate: string;
  endDate: string;
}

/** 一个实例占据的日期区间。全天跨天按「最后一天 00:00」的约定算含当天。 */
export function spanOf(item: OccurrenceView): Span {
  const anchor = item.startAt ?? item.endAt ?? '';
  const startDate = datePart(anchor);
  const endDate = item.endAt ? datePart(item.endAt) : startDate;
  return endDate < startDate ? { startDate, endDate: startDate } : { startDate, endDate };
}

/** 某个日期上可见的全天事项。 */
export function allDayFor(items: OccurrenceView[], date: string): OccurrenceView[] {
  return items.filter((item) => {
    if (!item.isAllDay) return false;
    const span = spanOf(item);
    return span.startDate <= date && date <= span.endDate;
  });
}

/**
 * 某个日期上可见的「有时间」的事项，跨天会被裁剪到当天：
 * 首日从原开始时刻起，末日到 24:00 止，中间整天。
 */
export function timedFor(items: OccurrenceView[], date: string): DayItem[] {
  const result: DayItem[] = [];

  for (const item of items) {
    if (item.isAllDay) continue;
    const span = spanOf(item);
    if (date < span.startDate || date > span.endDate) continue;

    if (item.timeType !== 'range') {
      const at = item.startAt ?? item.endAt!;
      if (datePart(at) !== date) continue;
      const minute = minutesOf(at);
      result.push({
        scheduleId: item.scheduleId,
        occurrenceKey: item.startAt ?? item.endAt ?? '',
        title: item.title,
        color: item.categoryColor,
        isDone: item.isDone,
        timeType: item.timeType,
        startMin: minute,
        endMin: minute,
        label: item.title,
        isPoint: true,
        isContinuationStart: false,
        isContinuationEnd: false,
      });
      continue;
    }

    const startMin = date === span.startDate ? minutesOf(item.startAt!) : 0;
    const endMin = date === span.endDate ? minutesOf(item.endAt!) : 24 * 60;
    const label =
      date === span.startDate && date === span.endDate
        ? `${timeLabel(item.startAt!)}–${timeLabel(item.endAt!)}`
        : date === span.startDate
          ? `${timeLabel(item.startAt!)}–`
          : date === span.endDate
            ? `–${timeLabel(item.endAt!)}`
            : '全天';

    result.push({
      scheduleId: item.scheduleId,
      occurrenceKey: item.startAt ?? item.endAt ?? '',
      title: item.title,
      color: item.categoryColor,
      isDone: item.isDone,
      timeType: 'range',
      startMin,
      endMin: Math.max(endMin, startMin + 30),
      label,
      isPoint: false,
      isContinuationStart: date !== span.startDate,
      isContinuationEnd: date !== span.endDate,
    });
  }

  return result;
}

/** 把一周/一天的日期范围写成「10月19日 – 10月25日」。 */
export function rangeLabel(start: string, end: string): string {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return `${a.getMonth() + 1}月${a.getDate()}日 – ${b.getMonth() + 1}月${b.getDate()}日`;
}

/** 「10月23日 周五」 */
export function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const weekday = WEEKDAYS[(d.getDay() + 6) % 7];
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekday}`;
}
