import type { Db } from '../db/driver';
import { addDays } from '../../shared/time';
import { listCategories } from '../repo/categories';
import { listTasks } from '../repo/tasks';
import { listOccurrenceViews } from './calendar';
import { sortTodoItems, type TodoItem } from '../../shared/todo';

const HORIZON_DAYS = 30;

/**
 * 待办列表的数据：`is_in_todo` 的日程（只取最近的一次实例）+ 全部纯任务。
 *
 * 为什么只取最近一次：一条每周重复的课如果铺开，列表里会连续出现四行一样的，
 * 用户要的是「下一节课」，不是「未来一个月的每一节」。
 */
export function listTodoItems(
  db: Db,
  options: { today: string; categoryId?: string | null; includeDone?: boolean },
): TodoItem[] {
  const { today, categoryId = undefined, includeDone = false } = options;
  const colorByCategory = new Map(listCategories(db).map((c) => [c.id, c.color]));

  // 日程：今天起 30 天内的实例，同一个日程只保留最早那一次
  const views = listOccurrenceViews(db, today, addDays(today, HORIZON_DAYS));
  const firstBySchedule = new Map<string, (typeof views)[number]>();
  for (const view of views) {
    const key = view.startAt ?? view.endAt ?? '';
    const existing = firstBySchedule.get(view.scheduleId);
    const existingKey = existing ? (existing.startAt ?? existing.endAt ?? '') : null;
    if (!existing || existingKey === null || key < existingKey) {
      firstBySchedule.set(view.scheduleId, view);
    }
  }

  // 只有 is_in_todo 的日程才进待办（FR-6.8）
  const inTodo = new Set(
    (db.prepare('SELECT id FROM schedules WHERE is_in_todo = 1').all() as { id: string }[]).map(
      (row) => row.id,
    ),
  );

  const items: TodoItem[] = [];

  for (const view of firstBySchedule.values()) {
    if (!inTodo.has(view.scheduleId)) continue;
    items.push({
      kind: 'schedule',
      key: `${view.scheduleId}|${view.startAt ?? view.endAt ?? ''}`,
      id: view.scheduleId,
      occurrenceStart: view.startAt ?? view.endAt ?? undefined,
      title: view.title,
      categoryId: view.categoryId,
      categoryColor: colorByCategory.get(view.categoryId) ?? '#8E8E93',
      timeType: view.timeType,
      startAt: view.startAt,
      endAt: view.endAt,
      isAllDay: view.isAllDay,
      isDone: view.isDone,
      note: null,
    });
  }

  for (const task of listTasks(db)) {
    items.push({
      kind: 'task',
      key: task.id,
      id: task.id,
      title: task.title,
      categoryId: task.categoryId,
      categoryColor: task.categoryId
        ? (colorByCategory.get(task.categoryId) ?? '#8E8E93')
        : '#8E8E93',
      timeType: 'task',
      startAt: null,
      endAt: null,
      isAllDay: false,
      isDone: task.isDone,
      note: task.note,
    });
  }

  let filtered = items;
  if (categoryId !== undefined) {
    filtered = filtered.filter((i) => i.categoryId === categoryId);
  }
  if (!includeDone) {
    filtered = filtered.filter((i) => !i.isDone);
  }

  const sorted = sortTodoItems(filtered);
  if (!includeDone) return sorted;

  // 已完成整体沉到末尾：界面上它们在「已完成」折叠区里，不和时间序混排（FR-6.13）。
  return [...sorted.filter((i) => !i.isDone), ...sorted.filter((i) => i.isDone)];
}
