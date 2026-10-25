import { useEffect, useState } from 'react';
import { layoutColumns } from './layoutColumns';

const PX_PER_MINUTE = 48 / 60;
const MIN_HEIGHT = 18;

export interface DayItem {
  scheduleId: string;
  title: string;
  color: string;
  isDone: boolean;
  timeType: 'range' | 'start_only' | 'end_only';
  startMin: number;
  endMin: number;
  label: string;
  isPoint: boolean;
  isContinuationStart: boolean;
  isContinuationEnd: boolean;
}

export interface DayColumnProps {
  index: number;
  date: string;
  isToday: boolean;
  items: DayItem[];
  onSelect: (scheduleId: string) => void;
}

export function DayColumn({ index, isToday, items, onSelect }: DayColumnProps): JSX.Element {
  const blocks = items.filter((i) => !i.isPoint);
  const points = items.filter((i) => i.isPoint);

  const placed = layoutColumns(
    blocks.map((b) => ({ id: b.scheduleId, startMin: b.startMin, endMin: b.endMin })),
    PX_PER_MINUTE,
    MIN_HEIGHT,
  );
  const byId = new Map(blocks.map((b) => [b.scheduleId, b]));

  return (
    <div className="cal__col" data-testid={`daycol-${index}`} data-today={isToday ? 'true' : 'false'}>
      {Array.from({ length: 24 }, (_, h) => (
        <div key={h} className="cal__gridline" style={{ top: h * 48 }} />
      ))}

      {placed.map((p) => {
        const item = byId.get(p.id)!;
        return (
          <button
            key={p.id}
            type="button"
            className="ev"
            data-testid={`block-${p.id}`}
            data-done={item.isDone ? 'true' : 'false'}
            data-cont-start={item.isContinuationStart ? 'true' : 'false'}
            data-cont-end={item.isContinuationEnd ? 'true' : 'false'}
            style={{
              top: p.topPx,
              height: p.heightPx,
              left: `${p.leftRatio * 100}%`,
              width: `${p.widthRatio * 100}%`,
              ['--ev-color' as string]: item.color,
            }}
            onClick={() => onSelect(p.id)}
          >
            <span className="ev-title truncate">{item.title}</span>
            <span className="ev-meta">{item.label}</span>
          </button>
        );
      })}

      {points.map((p) => (
        <button
          key={p.scheduleId}
          type="button"
          className={`point${p.timeType === 'end_only' ? ' point--end' : ''}`}
          data-testid={`point-${p.scheduleId}`}
          data-done={p.isDone ? 'true' : 'false'}
          style={{ top: p.startMin * PX_PER_MINUTE, ['--ev-color' as string]: p.color }}
          onClick={() => onSelect(p.scheduleId)}
        >
          <span className="point__bar" />
          <span className="point__label truncate">{p.title}</span>
        </button>
      ))}

      {isToday ? <NowLine /> : null}
    </div>
  );
}

/** 每分钟刷新一次，否则红线会停在打开应用的那一刻（FR-1.8）。 */
function NowLine(): JSX.Element {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const top = (now.getHours() * 60 + now.getMinutes()) * PX_PER_MINUTE;
  return <div className="nowline" style={{ top }} data-testid="nowline" />;
}
