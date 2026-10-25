import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { OccurrenceView } from '../../../shared/types';
import { addDays } from '../../../shared/time';
import { DayColumn } from './DayColumn';
import { TimeAxis } from './TimeAxis';
import { ViewSwitch, type ViewMode } from './ViewSwitch';
import { WEEKDAYS, allDayFor, rangeLabel, timedFor } from './spans';

const MAX_ALDAY_PILLS = 2;

export interface WeekViewProps {
  weekStart: string;
  occurrences: OccurrenceView[];
  today: string;
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onSelect: (scheduleId: string, occurrenceStart: string) => void;
}

export function WeekView({
  weekStart,
  occurrences,
  today,
  mode,
  onModeChange,
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

  const allDayMap = useMemo(() => {
    const map = new Map<string, OccurrenceView[]>();
    for (const date of dates) map.set(date, allDayFor(occurrences, date));
    return map;
  }, [dates, occurrences]);

  const timedMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof timedFor>>();
    for (const date of dates) map.set(date, timedFor(occurrences, date));
    return map;
  }, [dates, occurrences]);

  const select = useCallback((id: string, key: string) => onSelect(id, key), [onSelect]);

  return (
    <div className="cal">
      <div className="cal__toolbar">
        <ViewSwitch mode={mode} onChange={onModeChange} />
        <button type="button" className="cal__nav" aria-label="上一周" onClick={onPrevWeek}>
          ‹
        </button>
        <span className="cal__range">{rangeLabel(weekStart, addDays(weekStart, 6))}</span>
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
          const items = allDayMap.get(date) ?? [];
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
                  onClick={() => select(item.scheduleId, item.startAt ?? item.endAt ?? '')}
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
            items={timedMap.get(date) ?? []}
            onSelect={select}
          />
        ))}
      </div>
    </div>
  );
}
