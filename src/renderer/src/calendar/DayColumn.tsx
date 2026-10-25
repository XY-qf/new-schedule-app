import { useCallback, useEffect, useRef, useState } from 'react';
import { layoutColumns } from './layoutColumns';
import { isDragStarted, pxToMinutes, resolveDrag } from './drag';

const PX_PER_MINUTE = 48 / 60;
const HOUR_HEIGHT = 48;
const MIN_HEIGHT = 18;

export interface DayItem {
  scheduleId: string;
  /** 实例身份键：原始 startAt（end_only 用 endAt），用于「只改这一次」 */
  occurrenceKey: string;
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
  onSelect: (scheduleId: string, occurrenceStart: string) => void;
  /** 拖拽结束后回传新的起止分钟（相对当天） */
  onMove?: (scheduleId: string, occurrenceStart: string, startMin: number, endMin: number) => void;
}

interface DragState {
  scheduleId: string;
  occurrenceKey: string;
  originY: number;
  originTime: number;
  startMin: number;
  durationMin: number;
  dy: number;
  active: boolean;
}

export function DayColumn({
  index,
  isToday,
  items,
  onSelect,
  onMove,
}: DayColumnProps): JSX.Element {
  const blocks = items.filter((i) => !i.isPoint);
  const points = items.filter((i) => i.isPoint);
  const [drag, setDrag] = useState<DragState | null>(null);
  const suppressClick = useRef(false);

  const placed = layoutColumns(
    blocks.map((b) => ({ id: b.scheduleId, startMin: b.startMin, endMin: b.endMin })),
    PX_PER_MINUTE,
    MIN_HEIGHT,
  );
  const byId = new Map(blocks.map((b) => [b.scheduleId, b]));

  // 拖拽中按 Esc 取消（回弹），不写库
  useEffect(() => {
    if (!drag) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setDrag(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drag]);

  const finishDrag = useCallback(
    (state: DragState): void => {
      const moved = resolveDrag(
        state.startMin,
        state.durationMin,
        pxToMinutes(state.dy, HOUR_HEIGHT),
      );
      if (moved.startMin !== state.startMin) {
        onMove?.(state.scheduleId, state.occurrenceKey, moved.startMin, moved.endMin);
      }
    },
    [onMove],
  );

  return (
    <div className="cal__col" data-testid={`daycol-${index}`} data-today={isToday ? 'true' : 'false'}>
      {Array.from({ length: 24 }, (_, h) => (
        <div key={h} className="cal__gridline" style={{ top: h * 48 }} />
      ))}

      {placed.map((p) => {
        const item = byId.get(p.id)!;
        const isDragging = drag?.scheduleId === item.scheduleId && drag.active;
        return (
          <button
            key={p.id}
            type="button"
            className={isDragging ? 'ev is-dragging' : 'ev'}
            data-testid={`block-${p.id}`}
            data-done={item.isDone ? 'true' : 'false'}
            data-cont-start={item.isContinuationStart ? 'true' : 'false'}
            data-cont-end={item.isContinuationEnd ? 'true' : 'false'}
            style={{
              top: p.topPx + (isDragging ? drag.dy : 0),
              height: p.heightPx,
              left: `${p.leftRatio * 100}%`,
              width: `${p.widthRatio * 100}%`,
              ['--ev-color' as string]: item.color,
            }}
            onPointerDown={(e) => {
              if (!onMove || item.timeType !== 'range') return;
              suppressClick.current = false;
              setDrag({
                scheduleId: item.scheduleId,
                occurrenceKey: item.occurrenceKey,
                originY: e.clientY,
                originTime: Date.now(),
                startMin: item.startMin,
                durationMin: item.endMin - item.startMin,
                dy: 0,
                active: false,
              });
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drag || drag.scheduleId !== item.scheduleId) return;
              const next: DragState = { ...drag, dy: e.clientY - drag.originY };
              next.active = isDragStarted({
                originX: 0,
                originY: drag.originY,
                originTime: drag.originTime,
                x: 0,
                y: e.clientY,
                time: Date.now(),
              });
              setDrag(next);
            }}
            onPointerUp={() => {
              if (!drag || drag.scheduleId !== item.scheduleId) return;
              if (drag.active) {
                suppressClick.current = true;
                finishDrag(drag);
              }
              setDrag(null);
            }}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              onSelect(p.id, item.occurrenceKey);
            }}
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
          onClick={() => onSelect(p.scheduleId, p.occurrenceKey)}
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
