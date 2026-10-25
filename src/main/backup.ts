import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Db } from './db/driver';

const pad = (n: number): string => String(n).padStart(2, '0');

/** `ai-todo-backup-20261025-1930.db` */
export function backupFileName(now: Date): string {
  return `ai-todo-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.db`;
}

/**
 * 导出备份。
 *
 * WAL 模式下直接复制 .db 会丢掉还在 -wal 里、没 checkpoint 的数据，
 * 所以先 `wal_checkpoint(TRUNCATE)` 把 WAL 合回主库，再复制。
 */
export function exportBackup(db: Db, dbPath: string, targetDir: string, now = new Date()): string {
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  } catch {
    // 不是 WAL 模式（或 checkpoint 失败）也要能导出，忽略即可
  }

  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });

  const target = join(targetDir, backupFileName(now));
  copyFileSync(dbPath, target);

  if (!existsSync(target) || statSync(target).size === 0) {
    throw new Error('备份文件写入失败');
  }
  return target;
}

/** 导入前的安全备份：放在同目录下带 `pre-restore` 前缀。 */
export function backupBeforeRestore(db: Db, dbPath: string, now = new Date()): string {
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  } catch {
    /* 同上 */
  }
  const target = join(dirname(dbPath), `pre-restore-${backupFileName(now)}`);
  copyFileSync(dbPath, target);
  return target;
}
