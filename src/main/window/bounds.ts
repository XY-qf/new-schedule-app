export type ViewName = 'calendar' | 'todo';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayInfo {
  workArea: Rect;
}

export const VIEW_SIZE: Record<ViewName, { width: number; height: number }> = {
  calendar: { width: 1000, height: 700 },
  todo: { width: 400, height: 822 },
};

/**
 * 计算某个视图应当在屏幕上占据的窗口矩形。
 *
 * - 尺寸取 VIEW_SIZE，必要时收缩到工作区内；
 * - 有 previous 时以它的中心为中心，否则以工作区中心为中心；
 * - 结果夹回工作区，保证窗口不会跑到屏幕外；
 * - 坐标取整，避免多次切换后 0.5px 累积漂移。
 */
export function boundsForView(view: ViewName, display: DisplayInfo, previous?: Rect): Rect {
  const area = display.workArea;
  const size = VIEW_SIZE[view];

  const width = Math.min(size.width, area.width);
  const height = Math.min(size.height, area.height);

  const centerX = previous ? previous.x + previous.width / 2 : area.x + area.width / 2;
  const centerY = previous ? previous.y + previous.height / 2 : area.y + area.height / 2;

  const x = clamp(Math.round(centerX - width / 2), area.x, area.x + area.width - width);
  const y = clamp(Math.round(centerY - height / 2), area.y, area.y + area.height - height);

  return { x, y, width, height };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}
