/**
 * 拖拽改时间的纯逻辑与阈值常量。
 *
 * 防误触（FR-1.10）两条同时满足才算拖拽：
 *   1. 位移超过 4px
 *   2. 按住超过 180ms
 * 只有一条满足时仍然是「点击」，避免轻微抖动把日程挪走。
 */

export const DRAG_MIN_PX = 4;
export const DRAG_HOLD_MS = 180;
export const SNAP_MINUTES = 5;
export const MIN_DURATION_MINUTES = 15;
export const DAY_MINUTES = 24 * 60;

export interface DragIntent {
  /** 按下时的指针位置与时间戳 */
  originX: number;
  originY: number;
  originTime: number;
  /** 当前指针位置与时间戳 */
  x: number;
  y: number;
  time: number;
}

/** 是否已经构成拖拽（两个阈值都要满足）。 */
export function isDragStarted(intent: DragIntent): boolean {
  const distance = Math.hypot(intent.x - intent.originX, intent.y - intent.originY);
  const held = intent.time - intent.originTime;
  return distance >= DRAG_MIN_PX && held >= DRAG_HOLD_MS;
}

/** 吸附到 5 分钟。 */
export function snapMinutes(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

/**
 * 把「原开始分钟 + 位移分钟」算成新的起止分钟：
 * 吸附 → 夹在一天之内 → 保证至少 15 分钟。
 */
export function resolveDrag(
  startMin: number,
  durationMin: number,
  deltaMin: number,
): { startMin: number; endMin: number } {
  const duration = Math.max(MIN_DURATION_MINUTES, Math.round(durationMin));
  const maxStart = Math.max(0, DAY_MINUTES - duration);
  const nextStart = Math.min(maxStart, Math.max(0, snapMinutes(startMin + deltaMin)));
  return { startMin: nextStart, endMin: nextStart + duration };
}

/** 像素位移换分钟：一天的高度是 24 × 每小时像素。 */
export function pxToMinutes(deltaPx: number, hourHeight: number): number {
  return (deltaPx / hourHeight) * 60;
}

/** 'HH:mm' → 当天第几分钟。 */
export function clockToMinutes(clock: string): number {
  const [h, m] = clock.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

/** 当天第几分钟 → 'HH:mm'，24:00 折回 00:00（不该发生，兜底）。 */
export function minutesToClock(minutes: number): string {
  const clamped = Math.max(0, Math.min(DAY_MINUTES - 1, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
