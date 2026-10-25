import { useEffect, useMemo, useRef } from 'react';
import type { Category, OccurrenceView } from '../../../shared/types';
import { addDays } from '../../../shared/time';
import { DayColumn } from './DayColumn';
import { TimeAxis } from './TimeAxis';

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export interface WeekViewProps {
  weekStart: string;
  occurrences: OccurrenceView[];
  categories: Category[];
  today: string;
}

function anchorDate(item: OccurrenceView): string {
  return (item.startAt ?? item.endAt ?? '').slice(0, 10);
}

export function WeekView({ weekStart, occurrences, today }: WeekViewProps): JSX.Element {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 打开时定位到 07:00，而不是 00:00（PRD FR-1.2）。
    // 内容高度要等布局完成才准，所以放到两帧之后再滚，否则 scrollTop 会被钳回 0。
    const el = bodyRef.current;
    if (!el) return;
    const apply = (): void => {
      el.scrollTop = 7 * 48;
    };
    const raf1 = requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(apply);
    });
    return () => cancelAnimationFrame(raf1);
  }, [occurrences]);

  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const allDay = occurrences.filter((o) => o.isAllDay);
  const timed = occurrences.filter((o) => !o.isAllDay);

  return (
    <div className="cal">
      <div className="cal__heads">
        <div className="cal__gutter" />
        {dates.map((date, i) => (
          <div
            key={date}
            className={date === today ? 'cal__head is-today' : 'cal__head'}
            data-testid="weekday-head"
          >
            <span className="cal__weekday">{WEEKDAYS[i]}</span>
            <span className="cal__date">{Number(date.slice(8, 10))}</span>
          </div>
        ))}
      </div>

      <div className="cal__allday" data-testid="allday-row">
        <div className="cal__gutter cal__gutter--allday">全天</div>
        {dates.map((date) => (
          <div key={date} className="cal__allday-cell">
            {allDay
              .filter((o) => anchorDate(o) === date)
              .map((o) => (
                <span
                  key={o.scheduleId}
                  className={o.isDone ? 'allday-pill is-done' : 'allday-pill'}
                  style={{ ['--ev-color' as string]: o.categoryColor }}
                >
                  {o.title}
                </span>
              ))}
          </div>
        ))}
      </div>

      <div className="cal__body" ref={bodyRef}>
        <TimeAxis />
        {dates.map((date, i) => (
          <DayColumn
            key={date}
            index={i}
            date={date}
            isToday={date === today}
            items={timed.filter((o) => anchorDate(o) === date)}
          />
        ))}
      </div>
    </div>
  );
}