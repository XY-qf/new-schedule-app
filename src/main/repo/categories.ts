import { randomUUID } from 'node:crypto';
import type { Db } from '../db/driver';
import type { Category } from '../../shared/types';

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  remind_enabled: number;
  sort_order: number;
  is_builtin: number;
}

const SEED: ReadonlyArray<{ id: string; name: string; color: string }> = [
  { id: 'cat-course', name: '课程', color: '#4C8DFF' },
  { id: 'cat-hobby', name: '课外活动', color: '#FF9F0A' },
  { id: 'cat-life', name: '个人生活', color: '#34C759' },
];

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    remindEnabled: row.remind_enabled === 1,
    sortOrder: row.sort_order,
    isBuiltin: row.is_builtin === 1,
  };
}

export function listCategories(db: Db): Category[] {
  const rows = db
    .prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC')
    .all() as CategoryRow[];
  return rows.map(toCategory);
}

export function ensureSeedCategories(db: Db): void {
  const row = db.prepare('SELECT COUNT(*) AS c FROM categories').get() as { c: number };
  if (row.c > 0) return;

  SEED.forEach((seed, index) => {
    db.prepare(
      `INSERT INTO categories (id,name,color,remind_enabled,sort_order,is_builtin)
       VALUES (?,?,?,1,?,1)`,
    ).run(seed.id, seed.name, seed.color, index);
  });
}

export function createCategory(db: Db, input: { name: string; color: string }): Category {
  const row = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories')
    .get() as { m: number };
  const id = randomUUID();

  db.prepare(
    `INSERT INTO categories (id,name,color,remind_enabled,sort_order,is_builtin)
     VALUES (?,?,?,1,?,0)`,
  ).run(id, input.name, input.color, row.m + 1);

  return getCategory(db, id);
}

export function getCategory(db: Db, id: string): Category {
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as
    | CategoryRow
    | undefined;
  if (!row) throw new Error(`分类不存在: ${id}`);
  return toCategory(row);
}

export function updateCategory(
  db: Db,
  patch: { id: string; name?: string; color?: string; remindEnabled?: boolean },
): Category {
  const current = getCategory(db, patch.id);
  const name = patch.name ?? current.name;
  const color = patch.color ?? current.color;
  const remindEnabled = patch.remindEnabled ?? current.remindEnabled;

  db.prepare('UPDATE categories SET name = ?, color = ?, remind_enabled = ? WHERE id = ?').run(
    name,
    color,
    remindEnabled ? 1 : 0,
    patch.id,
  );

  return getCategory(db, patch.id);
}

export type DeleteStrategy = 'move' | 'deleteItems';

/**
 * 删除分类。内置分类一律拒绝（它们只能改名改色）。
 * - move：把该分类下的日程与纯任务迁到 moveToId，再删分类。
 * - deleteItems：连带删掉该分类下的日程与纯任务。
 * 整段包在一个事务里；注意 driver.transaction 不可嵌套。
 */
export function deleteCategory(
  db: Db,
  input: { id: string; strategy: DeleteStrategy; moveToId?: string },
): void {
  const target = getCategory(db, input.id);
  if (target.isBuiltin) {
    throw new Error('内置分类不允许删除，只能改名或改色');
  }

  if (input.strategy === 'move') {
    if (!input.moveToId) throw new Error('迁移策略必须指定目标分类');
    if (input.moveToId === input.id) throw new Error('不能迁移到被删除的分类自身');
    getCategory(db, input.moveToId);
  }

  db.transaction(() => {
    if (input.strategy === 'move') {
      const to = input.moveToId!;
      db.prepare('UPDATE schedules SET category_id = ? WHERE category_id = ?').run(to, input.id);
      db.prepare('UPDATE tasks SET category_id = ? WHERE category_id = ?').run(to, input.id);
    } else {
      db.prepare('DELETE FROM schedules WHERE category_id = ?').run(input.id);
      db.prepare('DELETE FROM tasks WHERE category_id = ?').run(input.id);
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(input.id);
  });
}