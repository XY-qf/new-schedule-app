import { describe, it, expect } from 'vitest';
import { openDatabase } from '../src/main/db/connection';
import { runMigrations } from '../src/main/db/migrate';
import {
  ensureSeedCategories,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../src/main/repo/categories';

function fresh() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  ensureSeedCategories(db);
  return db;
}

function addSchedule(db: ReturnType<typeof fresh>, id: string, categoryId: string) {
  db.exec(`INSERT INTO schedules
    (id,title,category_id,time_type,is_all_day,start_at,end_at,created_at,updated_at)
    VALUES ('${id}','x','${categoryId}','range',0,'2026-10-19T08:00:00','2026-10-19T09:00:00','t','t')`);
}

describe('分类仓储', () => {
  it('首次种子出三个内置分类，顺序为 课程/课外活动/个人生活', () => {
    const db = fresh();
    const list = listCategories(db);
    expect(list.map((c) => c.name)).toEqual(['课程', '课外活动', '个人生活']);
    expect(list.every((c) => c.isBuiltin)).toBe(true);
    db.close();
  });

  it('重复种子不会插两遍', () => {
    const db = fresh();
    ensureSeedCategories(db);
    expect(listCategories(db)).toHaveLength(3);
    db.close();
  });

  it('内置分类可改名改色', () => {
    const db = fresh();
    const target = listCategories(db)[0]!;
    const r = updateCategory(db, { id: target.id, name: '专业课', color: '#BF5AF2' });
    expect(r.name).toBe('专业课');
    expect(r.color).toBe('#BF5AF2');
    db.close();
  });

  it('内置分类不允许删除', () => {
    const db = fresh();
    expect(() =>
      deleteCategory(db, { id: listCategories(db)[0]!.id, strategy: 'deleteItems' }),
    ).toThrow(/内置/);
    db.close();
  });

  it('新增自定义分类排在最后', () => {
    const db = fresh();
    const c = createCategory(db, { name: '实习', color: '#5AC8FA' });
    expect(c.isBuiltin).toBe(false);
    expect(listCategories(db).at(-1)?.id).toBe(c.id);
    db.close();
  });

  it('删除自定义分类时把日程迁移到目标分类', () => {
    const db = fresh();
    const custom = createCategory(db, { name: '临时', color: '#8E8E93' });
    addSchedule(db, 's1', custom.id);
    const keep = listCategories(db)[0]!.id;

    deleteCategory(db, { id: custom.id, strategy: 'move', moveToId: keep });

    const row = db.prepare("SELECT category_id FROM schedules WHERE id='s1'").get() as {
      category_id: string;
    };
    expect(row.category_id).toBe(keep);
    db.close();
  });

  it('删除自定义分类时也要迁移该分类下的纯任务', () => {
    const db = fresh();
    const custom = createCategory(db, { name: '临时', color: '#8E8E93' });
    db.exec(
      `INSERT INTO tasks (id,title,category_id,created_at) VALUES ('t1','买电池','${custom.id}','t')`,
    );
    const keep = listCategories(db)[0]!.id;

    deleteCategory(db, { id: custom.id, strategy: 'move', moveToId: keep });

    const row = db.prepare("SELECT category_id FROM tasks WHERE id='t1'").get() as {
      category_id: string;
    };
    expect(row.category_id).toBe(keep);
    db.close();
  });

  it('选择连带删除时，该分类下的日程一并消失', () => {
    const db = fresh();
    const custom = createCategory(db, { name: '临时', color: '#8E8E93' });
    addSchedule(db, 's1', custom.id);

    deleteCategory(db, { id: custom.id, strategy: 'deleteItems' });

    expect(db.prepare('SELECT COUNT(*) c FROM schedules').get()).toEqual({ c: 0 });
    expect(listCategories(db).map((c) => c.id)).not.toContain(custom.id);
    db.close();
  });
});

describe('分类仓储 · 色板与孤儿规则（审查 Minor 10）', () => {
  it('颜色不在 12 色板内被拒绝', () => {
    const db = fresh();
    expect(() => createCategory(db, { name: '野色', color: '#123456' })).toThrow(/色板/);
    db.close();
  });

  it('色板内的颜色可以创建', () => {
    const db = fresh();
    const c = createCategory(db, { name: '实习', color: '#BF5AF2' });
    expect(c.color).toBe('#BF5AF2');
    db.close();
  });

  it('改用非法颜色会被拒绝', () => {
    const db = fresh();
    const c = createCategory(db, { name: '实习', color: '#BF5AF2' });
    expect(() => updateCategory(db, { id: c.id, color: 'red' })).toThrow(/色板/);
    db.close();
  });

  it('连带删除后不再被引用的重复规则会被清理', () => {
    const db = fresh();
    const custom = createCategory(db, { name: '临时', color: '#8E8E93' });
    db.exec("INSERT INTO recurrences (id,freq) VALUES ('r9','weekly')");
    db.prepare(
      `INSERT INTO schedules
        (id,title,category_id,time_type,is_all_day,start_at,end_at,recurrence_id,created_at,updated_at)
       VALUES ('s9','x',?,'range',0,'2026-10-19T08:00:00','2026-10-19T09:00:00','r9','t','t')`,
    ).run(custom.id);

    deleteCategory(db, { id: custom.id, strategy: 'deleteItems' });

    expect(db.prepare("SELECT COUNT(*) c FROM recurrences WHERE id='r9'").get()).toEqual({ c: 0 });
    db.close();
  });
});
