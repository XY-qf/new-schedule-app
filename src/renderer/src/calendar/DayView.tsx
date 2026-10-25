import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { OccurrenceView } from '../../../shared/types';
import { addDays } from '../../../shared/time';
import { DayColumn } from './DayColumn';
import { TimeAxis } from './TimeAxis';
import { allDayFor, dayLabel, timedFor } from './spans';
import { ViewSwitch, type ViewMode } from './ViewSwitch';

export interface DayViewProps {
  date: string;
  occurrences: OccurrenceView[];
  today: string;
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelect: (scheduleId: string) => void;
}

export function DayView({
  date,
  occurrences,
  today,
  mode,
  onModeChange,
  onPrev,
  onNext,
  onToday,
  onSelect,
}: DayViewProps): JSX.Element {
  const bodyRef = useRef<HTMLDivElement>(null);
  const placedDate = useRef<string | null>(null);

  const isToday = date === today;
  const allDay = useMemo(() => allDayFor(occurrences, date), [occurrences, date]);
  const timed = useMemo(() => timedFor(occurrences, date), [occurrences, date]);

  useEffect(() => {
    if (placedDate.current === date) return;
    const el = bodyRef.current;
    if (!el) return;
    placedDate.current = date;
    const apply = (): void => {
      el.scrollTop = 7 * 48 - 10;
    };
    requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(apply);
    });
  }, [date]);

  const select = useCallback((id: string) => onSelect(id), [onSelect]);

  return (
    <div className="cal">
      <div className="cal__toolbar">
        <ViewSwitch mode={mode} onChange={onModeChange} />
        <button type="button" className="cal__nav" aria-label="前一天" onClick={onPrev}>
          ‹
        </button>
        <span className="cal__range" data-testid="day-title">
          {dayLabel(date)}
        </span>
        <button type="button" className="cal__nav" aria-label="后一天" onClick={onNext}>
          ›
        </button>
        <button type="button" className="cal__today-btn" onClick={onToday}>
          今天
        </button>
      </div>

      <div className="cal__allday">
        <div className="cal__gutter cal__gutter--allday">全天</div>
        <div className="cal__allday-cell" data-testid="allday-day">
          {allDay.map((item) => (
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
        </div>
      </div>

      <div className="cal__body" ref={bodyRef}>
        <TimeAxis />
        <DayColumn index={0} date={date} isToday={isToday} items={timed} onSelect={select} />
      </div>
    </div>
  );
}

export { addDays };
