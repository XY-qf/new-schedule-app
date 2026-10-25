import { randomUUID } from 'node:crypto';
import type { Db } from '../db/driver';
import { nowLocal } from '../../shared/time';

export interface Task {
  id: string;
  title: string;
  categoryId: string | null;
  note: string | null;
  isDone: boolean;
  doneAt: string | null;
  createdAt: string;
}

interface TaskRow {
  id: string;
  title: string;
  category_id: string | null;
  note: string | null;
  is_done: number;
  done_at: string | null;
  created_at: string;
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    categoryId: row.category_id,
    note: row.note,
    isDone: row.is_done === 1,
    doneAt: row.done_at,
    createdAt: row.created_at,
  };
}

export function listTasks(db: Db): Task[] {
  const rows = db.prepare('SELECT * FROM tasks ORDER BY created_at, id').all() as TaskRow[];
  return rows.map(toTask);
}

export function getTask(db: Db, id: string): Task {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
  if (!row) throw new Error(`任务不存在: ${id}`);
  return toTask(row);
}

export function createTask(
  db: Db,
  input: { title: string; categoryId?: string | null; note?: string | null },
): Task {
  const id = randomUUID();
  db.prepare(
    'INSERT INTO tasks (id,title,category_id,note,is_done,done_at,created_at) VALUES (?,?,?,?,0,NULL,?)',
  ).run(id, input.title, input.categoryId ?? null, input.note ?? null, nowLocal());
  return getTask(db, id);
}

export function updateTask(
  db: Db,
  id: string,
  patch: { title?: string; categoryId?: string | null; note?: string | null },
): Task {
  return db.transaction(() => {
    const cur = getTask(db, id);
    db.prepare('UPDATE tasks SET title = ?, category_id = ?, note = ? WHERE id = ?').run(
      patch.title ?? cur.title,
      patch.categoryId !== undefined ? patch.categoryId : cur.categoryId,
      patch.note !== undefined ? patch.note : cur.note,
      id,
    );
    return getTask(db, id);
  });
}

/** 纯任务的完成态。`done_at` 与 `is_done` 必须同时改，DDL 有 CHECK 约束。 */
export function setTaskDone(db: Db, id: string, isDone: boolean): Task {
  const now = nowLocal();
  db.prepare('UPDATE tasks SET is_done = ?, done_at = ? WHERE id = ?').run(
    isDone ? 1 : 0,
    isDone ? now : null,
    id,
  );
  return getTask(db, id);
}

export function deleteTask(db: Db, id: string): void {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}
