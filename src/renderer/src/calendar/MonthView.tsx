import { useMemo } from 'react';
import type { OccurrenceView } from '../../../shared/types';
import { addMonths, monthGrid, startOfMonth } from '../../../shared/time';
import { ViewSwitch, type ViewMode } from './ViewSwitch';
import { WEEKDAYS, allDayFor, timedFor } from './spans';

const MAX_BARS = 2;

export interface MonthViewProps {
  anchor: string;
  occurrences: OccurrenceView[];
  today: string;
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  onPickDate: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelect: (scheduleId: string) => void;
}

function monthLabel(anchor: string): string {
  const d = new Date(`${anchor}T00:00:00`);
  return `${d.getFullYear()}年 ${d.getMonth() + 1}月`;
}

interface Bar {
  scheduleId: string;
  title: string;
  color: string;
  isDone: boolean;
}

export function MonthView({
  anchor,
  occurrences,
  today,
  mode,
  onModeChange,
  onPickDate,
  onPrev,
  onNext,
  onToday,
  onSelect,
}: MonthViewProps): JSX.Element {
  const grid = useMemo(() => monthGrid(anchor), [anchor]);
  const monthPrefix = startOfMonth(anchor).slice(0, 7);

  const barsByDate = useMemo(() => {
    const map = new Map<string, Bar[]>();
    for (const date of grid) {
      const bars: Bar[] = [
        ...allDayFor(occurrences, date).map((o) => ({
          scheduleId: o.scheduleId,
          title: o.title,
          color: o.categoryColor,
          isDone: o.isDone,
        })),
        ...timedFor(occurrences, date)
          .filter((t) => !t.isPoint || true)
          .map((t) => ({
            scheduleId: t.scheduleId,
            title: t.title,
            color: t.color,
            isDone: t.isDone,
          })),
      ];
      map.set(date, bars);
    }
    return map;
  }, [grid, occurrences]);

  return (
    <div className="cal">
      <div className="cal__toolbar">
        <ViewSwitch mode={mode} onChange={onModeChange} />
        <button type="button" className="cal__nav" aria-label="上个月" onClick={onPrev}>
          ‹
        </button>
        <span className="cal__range">{monthLabel(anchor)}</span>
        <button type="button" className="cal__nav" aria-label="下个月" onClick={onNext}>
          ›
        </button>
        <button type="button" className="cal__today-btn" onClick={onToday}>
          今天
        </button>
      </div>

      <div className="month">
        <div className="month__heads">
          {WEEKDAYS.map((w) => (
            <div key={w} className="month__head">
              {w}
            </div>
          ))}
        </div>
        <div className="month__grid">
          {grid.map((date) => {
            const bars = barsByDate.get(date) ?? [];
            const shown = bars.slice(0, MAX_BARS);
            const rest = bars.length - shown.length;
            const outside = !date.startsWith(monthPrefix);
            return (
              <button
                key={date}
                type="button"
                className={[
                  'month__cell',
                  outside ? 'is-outside' : '',
                  date === today ? 'is-today' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-testid={`mcell-${date}`}
                onClick={() => onPickDate(date)}
              >
                <span className="month__day">{Number(date.slice(8, 10))}</span>
                {shown.map((bar) => (
                  <span
                    key={`${bar.scheduleId}-${date}`}
                    className={bar.isDone ? 'month__bar is-done' : 'month__bar'}
                    style={{ ['--ev-color' as string]: bar.color }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(bar.scheduleId);
                    }}
                  >
                    {bar.title}
                  </span>
                ))}
                {rest > 0 ? <span className="month__more">还有 {rest} 条</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { addMonths };
