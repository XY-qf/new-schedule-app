import { describe, it, expect } from 'vitest';
import { openDatabase, type Db } from '../src/main/db/connection';
import { runMigrations, type Migration } from '../src/main/db/migrate';

const testMigrations: Migration[] = [
  { version: 1, up: (db) => db.exec('create table t(a integer)') },
];

describe('迁移器', () => {
  it('打开即启用外键', () => {
    const db = openDatabase(':memory:');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    db.close();
  });

  it('按 migration.up 推进 user_version 并建表', () => {
    const db: Db = openDatabase(':memory:');
    expect(db.pragma('user_version', { simple: true })).toBe(0);

    runMigrations(db, testMigrations);

    expect(db.pragma('user_version', { simple: true })).toBe(1);
    const row = db
      .prepare("select name from sqlite_master where type='table' and name='t'")
      .get() as { name: string } | undefined;
    expect(row?.name).toBe('t');
    db.close();
  });

  it('重复迁移是幂等的', () => {
    const db = openDatabase(':memory:');
    runMigrations(db, testMigrations);
    expect(() => runMigrations(db, testMigrations)).not.toThrow();
    expect(db.pragma('user_version', { simple: true })).toBe(1);
    db.close();
  });

  it('某个迁移抛错时整体回滚，user_version 不前进', () => {
    const broken: Migration[] = [
      {
        version: 1,
        up: (db) => {
          db.exec('create table u(a integer)');
          throw new Error('boom');
        },
      },
    ];
    const db = openDatabase(':memory:');

    expect(() => runMigrations(db, broken)).toThrow('boom');
    expect(db.pragma('user_version', { simple: true })).toBe(0);
    const row = db
      .prepare("select name from sqlite_master where type='table' and name='u'")
      .get() as { name: string } | undefined;
    expect(row).toBeUndefined();
    db.close();
  });
});
