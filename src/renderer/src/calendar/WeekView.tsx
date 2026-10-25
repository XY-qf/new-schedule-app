import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Category, OccurrenceView } from '../../../shared/types';
import { addDays, datePart } from '../../../shared/time';
import { DayColumn, type DayItem } from './DayColumn';
import { TimeAxis } from './TimeAxis';

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const MAX_ALDAY_PILLS = 2;

function minutesOf(iso: string): number {
  return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
}

function timeLabel(iso: string): string {
  return iso.slice(11, 16);
}

function rangeLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(`${addDays(weekStart, 6)}T00:00:00`);
  return `${start.getMonth() + 1}月${start.getDate()}日 – ${end.getMonth() + 1}月${end.getDate()}日`;
}

interface Span {
  startDate: string;
  endDate: string;
}

/** 一个实例占据的日期区间。全天跨天按「最后一天 00:00」的约定算含当天。 */
function spanOf(item: OccurrenceView): Span {
  const anchor = item.startAt ?? item.endAt ?? '';
  const startDate = datePart(anchor);
  const endDate = item.endAt ? datePart(item.endAt) : startDate;
  return endDate < startDate ? { startDate, endDate: startDate } : { startDate, endDate };
}

export interface WeekViewProps {
  weekStart: string;
  occurrences: OccurrenceView[];
  categories: Category[];
  today: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onSelect: (scheduleId: string) => void;
}

export function WeekView({
  weekStart,
  occurrences,
  today,
  onPrevWeek,
  onNextWeek,
  onToday,
  onSelect,
}: WeekViewProps): JSX.Element {
  const bodyRef = useRef<HTMLDivElement>(null);
  const placedWeek = useRef<string | null>(null);

  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // 只在首次载入或切周时定位到 07:00；保存后刷新不应把用户滚动位置弹回去。
  useEffect(() => {
    if (placedWeek.current === weekStart) return;
    const el = bodyRef.current;
    if (!el) return;
    placedWeek.current = weekStart;
    const apply = (): void => {
      el.scrollTop = 7 * 48 - 10;
    };
    requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(apply);
    });
  }, [weekStart]);

  const spans = useMemo(
    () => occurrences.map((o) => ({ item: o, span: spanOf(o) })),
    [occurrences],
  );

  const allDayByDate = useMemo(() => {
    const map = new Map<string, OccurrenceView[]>();
    for (const date of dates) {
      map.set(
        date,
        spans
          .filter(({ item, span }) => item.isAllDay && span.startDate <= date && date <= span.endDate)
          .map(({ item }) => item),
      );
    }
    return map;
  }, [dates, spans]);

  const timedByDate = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    for (const date of dates) {
      const items: DayItem[] = [];
      for (const { item, span } of spans) {
        if (item.isAllDay) continue;
        if (date < span.startDate || date > span.endDate) continue;

        if (item.timeType !== 'range') {
          const at = item.startAt ?? item.endAt!;
          if (datePart(at) !== date) continue;
          items.push({
            scheduleId: item.scheduleId,
            title: item.title,
            color: item.categoryColor,
            isDone: item.isDone,
            timeType: item.timeType,
            startMin: minutesOf(at),
            endMin: minutesOf(at),
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

        items.push({
          scheduleId: item.scheduleId,
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
      map.set(date, items);
    }
    return map;
  }, [dates, spans]);

  const select = useCallback((id: string) => onSelect(id), [onSelect]);

  return (
    <div className="cal">
      <div className="cal__toolbar">
        <button type="button" className="cal__nav" aria-label="上一周" onClick={onPrevWeek}>
          ‹
        </button>
        <span className="cal__range">{rangeLabel(weekStart)}</span>
        <button type="button" className="cal__nav" aria-label="下一周" onClick={onNextWeek}>
          ›
        </button>
        <button type="button" className="cal__today-btn" onClick={onToday}>
          今天
        </button>
      </div>

      <div className="cal__heads">
        <div className="cal__gutter" />
        {dates.map((date, i) => (
          <div
            key={date}
            className={date === today ? 'cal__head is-today' : 'cal__head'}
            data-testid="weekday-head"
            data-date={date}
          >
            <span className="cal__weekday">{WEEKDAYS[i]}</span>
            <span className="cal__date">{Number(date.slice(8, 10))}</span>
          </div>
        ))}
      </div>

      <div className="cal__allday" data-testid="allday-row">
        <div className="cal__gutter cal__gutter--allday">全天</div>
        {dates.map((date) => {
          const items = allDayByDate.get(date) ?? [];
          const shown = items.slice(0, MAX_ALDAY_PILLS);
          const rest = items.length - shown.length;
          return (
            <div key={date} className="cal__allday-cell" data-testid={`allday-${date}`}>
              {shown.map((item) => (
                <button
                  key={item.scheduleId}
                  type="button"
                  className={item.isDone ? 'allday-pill is-done' : 'allday-pill'}
                  style={{ ['--ev-color' as string]: item.categoryColor }}
                  onClick={() => select(item.scheduleId)}
                >
                  {item.title}
                </button>
              ))}
              {rest > 0 ? <span className="allday-more">还有 {rest} 条</span> : null}
            </div>
          );
        })}
      </div>

      <div className="cal__body" ref={bodyRef}>
        <TimeAxis />
        {dates.map((date, i) => (
          <DayColumn
            key={date}
            index={i}
            date={date}
            isToday={date === today}
            items={timedByDate.get(date) ?? []}
            onSelect={select}
          />
        ))}
      </div>
    </div>
  );
}
