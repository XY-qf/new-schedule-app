import { describe, it, expect } from 'vitest';
import { openDatabase } from '../src/main/db/connection';
import { runMigrations } from '../src/main/db/migrate';

function fresh() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  db.exec("INSERT INTO categories VALUES ('c1','课程','#4C8DFF',1,0,1)");
  return db;
}

const INS = (cols: string, vals: string) =>
  `INSERT INTO schedules (id,title,category_id,created_at,updated_at,${cols}) VALUES ('s1','x','c1','t','t',${vals})`;

describe('schema 001 · 表与引用', () => {
  it('九张表都存在', () => {
    const db = fresh();
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name);
    for (const t of [
      'categories',
      'recurrences',
      'schedules',
      'periods',
      'schedule_exceptions',
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
    db.exec(INS('time_type,is_all_day,start_at,end_at', "'range',0,'2026-10-19T08:00:00','2026-10-19T09:35:00'"));
    expect(() => db.exec("DELETE FROM categories WHERE id='c1'")).toThrow();
    db.close();
  });

  it('删除仍被任务引用的分类同样被拒绝', () => {
    const db = fresh();
    db.exec("INSERT INTO tasks (id,title,category_id,created_at) VALUES ('t1','买电池','c1','t')");
    expect(() => db.exec("DELETE FROM categories WHERE id='c1'")).toThrow();
    db.close();
  });

  it('两条日程不能共用同一条重复规则', () => {
    const db = fresh();
    db.exec("INSERT INTO recurrences (id,freq) VALUES ('r1','weekly')");
    db.exec(INS('time_type,is_all_day,start_at,end_at,recurrence_id', "'range',0,'2026-10-19T08:00:00','2026-10-19T09:35:00','r1'"));
    expect(() =>
      db.exec(
        `INSERT INTO schedules (id,title,category_id,created_at,updated_at,time_type,is_all_day,start_at,end_at,recurrence_id)
         VALUES ('s2','y','c1','t','t','range',0,'2026-10-20T08:00:00','2026-10-20T09:35:00','r1')`,
      ),
    ).toThrow();
    db.close();
  });

  it('删除日程会级联删掉它的提醒', () => {
    const db = fresh();
    db.exec(INS('time_type,is_all_day,start_at,end_at', "'range',0,'2026-10-19T08:00:00','2026-10-19T09:35:00'"));
    db.exec("INSERT INTO reminders (id,owner_id,offset_minutes) VALUES ('rm1','s1',30)");
    db.exec("DELETE FROM schedules WHERE id='s1'");
    expect(db.prepare('SELECT COUNT(*) c FROM reminders').get()).toEqual({ c: 0 });
    db.close();
  });
});

describe('schema 001 · 非法状态必须被拒绝', () => {
  it('全天日程缺 start_at', () => {
    const db = fresh();
    expect(() => db.exec(INS('time_type,is_all_day', "'range',1"))).toThrow();
    db.close();
  });

  it('全天日程必须用 range 形态', () => {
    const db = fresh();
    expect(() =>
      db.exec(INS('time_type,is_all_day,start_at', "'start_only',1,'2026-10-19T08:00:00'")),
    ).toThrow();
    db.close();
  });

  it('range 缺 end_at', () => {
    const db = fresh();
    expect(() =>
      db.exec(INS('time_type,is_all_day,start_at', "'range',0,'2026-10-19T08:00:00'")),
    ).toThrow();
    db.close();
  });

  it('start_only 缺 start_at', () => {
    const db = fresh();
    expect(() =>
      db.exec(INS('time_type,is_all_day,end_at', "'start_only',0,'2026-10-19T08:00:00'")),
    ).toThrow();
    db.close();
  });

  it('end_only 缺 end_at', () => {
    const db = fresh();
    expect(() => db.exec(INS('time_type,is_all_day', "'end_only',0"))).toThrow();
    db.close();
  });

  it('结束早于开始', () => {
    const db = fresh();
    expect(() =>
      db.exec(INS('time_type,is_all_day,start_at,end_at', "'range',0,'2026-10-19T10:00:00','2026-10-19T09:00:00'")),
    ).toThrow();
    db.close();
  });

  it('已完成却没有完成时间', () => {
    const db = fresh();
    expect(() =>
      db.exec(INS('time_type,is_all_day,start_at,end_at,is_done', "'range',0,'2026-10-19T08:00:00','2026-10-19T09:00:00',1")),
    ).toThrow();
    db.close();
  });

  it('非法 time_type', () => {
    const db = fresh();
    expect(() => db.exec(INS('time_type,is_all_day', "'garbage',0"))).toThrow();
    db.close();
  });

  it('重复规则的 freq 必须是已知值', () => {
    const db = fresh();
    expect(() => db.exec("INSERT INTO recurrences (id,freq) VALUES ('r1','yearly')")).toThrow();
    db.close();
  });

  it('提醒的两个提前量不能同时为空或同时有值', () => {
    const db = fresh();
    db.exec(INS('time_type,is_all_day,start_at,end_at', "'range',0,'2026-10-19T08:00:00','2026-10-19T09:00:00'"));
    expect(() =>
      db.exec("INSERT INTO reminders (id,owner_id) VALUES ('rm1','s1')"),
    ).toThrow();
    expect(() =>
      db.exec("INSERT INTO reminders (id,owner_id,offset_minutes,day_offset) VALUES ('rm2','s1',30,1)"),
    ).toThrow();
    db.close();
  });

  it('提醒不能挂在不存在的日程上', () => {
    const db = fresh();
    expect(() =>
      db.exec("INSERT INTO reminders (id,owner_id,offset_minutes) VALUES ('rm1','nope',30)"),
    ).toThrow();
    db.close();
  });
});
