import { describe, it, expect } from 'vitest';
import { openDatabase } from '../src/main/db/connection';
import { runMigrations } from '../src/main/db/migrate';

function fresh() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  return db;
}

describe('schema 001', () => {
  it('七张表都存在', () => {
    const db = fresh();
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name);
    for (const t of [
      'categories',
      'recurrences',
      'schedules',
      'tasks',
      'countdowns',
      'reminders',
      'settings',
    ]) {
      expect(names).toContain(t);
    }
    db.close();
  });

  it('删除仍被日程引用的分类会被拒绝', () => {
    const db = fresh();
    db.exec("INSERT INTO categories VALUES ('c1','课程','#4C8DFF',1,0,1)");
    db.exec(`INSERT INTO schedules
      (id,title,category_id,time_type,is_all_day,start_at,end_at,created_at,updated_at)
      VALUES ('s1','高数','c1','range',0,'2026-10-19T08:00:00','2026-10-19T09:35:00','x','x')`);
    expect(() => db.exec("DELETE FROM categories WHERE id='c1'")).toThrow();
    db.close();
  });

  it('全天日程必须有 start_at', () => {
    const db = fresh();
    db.exec("INSERT INTO categories VALUES ('c1','课程','#4C8DFF',1,0,1)");
    expect(() =>
      db.exec(`INSERT INTO schedules
        (id,title,category_id,time_type,is_all_day,created_at,updated_at)
        VALUES ('s1','体检','c1','range',1,'x','x')`),
    ).toThrow();
    db.close();
  });
});
