import type { Db } from './driver';

export interface Migration {
  version: number;
  up: (db: Db) => void;
}

/** T6 会往这里加 001_init；T5 阶段故意为空。 */
export const MIGRATIONS: Migration[] = [];

/**
 * 按 version 升序执行尚未应用的迁移。
 * 每个迁移连同 user_version 的推进包在同一个事务里：失败则整体回滚，不会留下半截 schema。
 */
export function runMigrations(db: Db, migrations: Migration[] = MIGRATIONS): void {
  const current = Number(db.pragma('user_version', { simple: true }) ?? 0);
  const pending = migrations
    .filter((m) => m.version > current)
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    db.transaction(() => {
      migration.up(db);
      db.exec(`PRAGMA user_version = ${migration.version}`);
    });
  }
}