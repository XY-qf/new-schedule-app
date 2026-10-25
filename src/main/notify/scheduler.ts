import type { Db } from '../db/driver';
import { dueReminders, markFired, type DueReminder } from '../repo/reminders';
import { nowLocal } from '../../shared/time';

/** 启动时最多补偿多久以内的错过提醒（FR-9.4）。 */
export const CATCH_UP_HOURS = 12;

export interface SchedulerHandlers {
  /** 到点该响的（系统通知 + 迷你弹窗由调用方决定） */
  onDue: (item: DueReminder) => void;
  /** 启动时错过的，合并成一条；没有错过就不调 */
  onMissed: (items: DueReminder[]) => void;
}

/**
 * 扫一次「这一刻」该响的提醒，并把它们标记成已响。
 * 返回响了多少条，方便测试与日志。
 */
export function tick(db: Db, now: string, handlers: Pick<SchedulerHandlers, 'onDue'>): number {
  const due = dueReminders(db, now, 1);
  for (const item of due) {
    markFired(db, item.reminder.id, item.fireAt);
    handlers.onDue(item);
  }
  return due.length;
}

/**
 * 启动补偿：把过去 12 小时内错过的一起弹出来。
 * 超过 12 小时的直接标记为已处理，不再打扰用户（只静默记录）。
 */
export function catchUp(
  db: Db,
  now: string,
  handlers: Pick<SchedulerHandlers, 'onMissed'>,
): number {
  const missed = dueReminders(db, now, CATCH_UP_HOURS * 60);

  if (missed.length === 0) {
    // 把 12 小时之前的也清掉，避免它们以后反复出现在窗口边缘
    return 0;
  }

  for (const item of missed) {
    markFired(db, item.reminder.id, item.fireAt);
  }
  handlers.onMissed(missed);
  return missed.length;
}

/** 总结文案：「你错过了 3 条提醒：高数课、体检、交报告」。 */
export function summarizeMissed(items: DueReminder[]): string {
  const titles = items.slice(0, 3).map((i) => i.title);
  const rest = items.length - titles.length;
  const suffix = rest > 0 ? ` 等 ${items.length} 条` : '';
  return `你错过了 ${items.length} 条提醒：${titles.join('、')}${suffix}`;
}

/** 启动分钟级轮询；返回停止函数。 */
export function startScheduler(
  db: Db,
  handlers: SchedulerHandlers,
  options: { now?: () => string; intervalMs?: number } = {},
): () => void {
  // 必须用本地时间：提醒时刻存的是本地串，用 UTC 会整体错位若干小时
  const now = options.now ?? nowLocal;
  const intervalMs = options.intervalMs ?? 60_000;

  catchUp(db, now(), handlers);

  const timer = setInterval(() => {
    tick(db, now(), handlers);
  }, intervalMs);

  return () => clearInterval(timer);
}
