import type { OccurrenceView } from '../../../shared/types';
import { layoutColumns } from './layoutColumns';

const PX_PER_MINUTE = 48 / 60;
const MIN_HEIGHT = 18;

function minutesOf(iso: string): number {
  return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
}

function timeLabel(iso: string): string {
  return iso.slice(11, 16);
}

export interface DayColumnProps {
  index: number;
  date: string;
  isToday: boolean;
  items: OccurrenceView[];
}

export function DayColumn({ index, date, isToday, items }: DayColumnProps): JSX.Element {
  const blocks = items.filter((i) => i.timeType === 'range');
  const points = items.filter((i) => i.timeType !== 'range');

  const placed = layoutColumns(
    blocks.map((b) => {
      const startMin = minutesOf(b.startAt!);
      const endMin = b.endAt ? minutesOf(b.endAt) : startMin + 30;
      return { id: b.scheduleId, startMin, endMin };
    }),
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
        const label = item.endAt
          ? `${timeLabel(item.startAt!)}–${timeLabel(item.endAt)}`
          : timeLabel(item.startAt!);
        return (
          <div
            key={p.id}
            className="ev"
            data-testid={`block-${p.id}`}
            data-done={item.isDone ? 'true' : 'false'}
            style={{
              top: p.topPx,
              height: p.heightPx,
              left: `${p.leftRatio * 100}%`,
              width: `${p.widthRatio * 100}%`,
              ['--ev-color' as string]: item.categoryColor,
            }}
          >
            <span className="ev-title truncate">{item.title}</span>
            <span className="ev-meta">{label}</span>
          </div>
        );
      })}

      {points.map((p) => {
        const at = p.startAt ?? p.endAt!;
        return (
          <div
            key={p.scheduleId}
            className={`point${p.timeType === 'end_only' ? ' point--end' : ''}`}
            data-testid={`point-${p.scheduleId}`}
            style={{ top: minutesOf(at) * PX_PER_MINUTE, ['--ev-color' as string]: p.categoryColor }}
          >
            <span className="point__bar" />
            <span className="point__label truncate">{p.title}</span>
          </div>
        );
      })}

      {isToday ? <NowLine /> : null}
    </div>
  );
}

function NowLine(): JSX.Element {
  const now = new Date();
  const top = (now.getHours() * 60 + now.getMinutes()) * PX_PER_MINUTE;
  return <div className="nowline" style={{ top }} data-testid="nowline" />;
}