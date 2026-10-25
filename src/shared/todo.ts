import type { TimeType } from './types';

/** 待办列表里的一行。日程与纯任务合并成同一种形状，界面只认这一种。 */
export interface TodoItem {
  kind: 'schedule' | 'task';
  /** 唯一键：日程用 `scheduleId|occurrenceStart`，任务用 taskId */
  key: string;
  /** scheduleId 或 taskId */
  id: string;
  /** 仅日程：这一次实例的原始开始时间，用于「只完成这一次」 */
  occurrenceStart?: string;
  title: string;
  categoryId: string | null;
  categoryColor: string;
  timeType: TimeType | 'task';
  startAt: string | null;
  endAt: string | null;
  isAllDay: boolean;
  isDone: boolean;
  note: string | null;
}

/** 纯任务排序用的假时间，保证它们永远排在最后（FR-6.6）。 */
const TASK_SORT_KEY = '9999-12-31T23:59:59';

function sortKey(item: TodoItem): string {
  if (item.kind === 'task') return TASK_SORT_KEY;
  return item.startAt ?? item.endAt ?? TASK_SORT_KEY;
}

/** 时间升序 → 同一时刻把已完成的排后面（同级保持稳定顺序）。 */
export function sortTodoItems(items: TodoItem[]): TodoItem[] {
  return [...items].sort((a, b) => {
    const byTime = sortKey(a).localeCompare(sortKey(b));
    if (byTime !== 0) return byTime;
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
    return a.key.localeCompare(b.key);
  });
}

function clock(iso: string | null): string {
  return iso ? iso.slice(11, 16) : '';
}

/** 第二行的时间信息（FR-6.4）。 */
export function formatTimeInfo(item: TodoItem): string {
  if (item.kind === 'task') return item.note ?? '';
  if (item.isAllDay) return '全天';

  switch (item.timeType) {
    case 'start_only':
      return `${clock(item.startAt)} 开始`;
    case 'end_only':
      return `截止 ${clock(item.endAt)}`;
    default:
      if (item.startAt && item.endAt) {
        const startDay = item.startAt.slice(0, 10);
        const endDay = item.endAt.slice(0, 10);
        if (startDay !== endDay) {
          return `${item.startAt.slice(5, 10)} ${clock(item.startAt)} – ${item.endAt.slice(5, 10)} ${clock(item.endAt)}`;
        }
        return `${clock(item.startAt)}–${clock(item.endAt)}`;
      }
      return clock(item.startAt ?? item.endAt);
  }
}

function toUTC(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/**
 * 从 today 到 targetDate 差几天。用本地日历日相减，不走毫秒差，
 * 免得夏令时切换那天算出 0.96 天再被取整成 0。
 */
export function daysUntil(targetDate: string, today: string): number {
  return Math.round((toUTC(targetDate) - toUTC(today)) / 86_400_000);
}

/** 倒计时的展示文案：D-3 / 今天 / 已过 2 天。 */
export function formatCountdown(targetDate: string, today: string): string {
  const days = daysUntil(targetDate, today);
  if (days === 0) return '今天';
  if (days > 0) return `D-${days}`;
  return `已过 ${Math.abs(days)} 天`;
}
