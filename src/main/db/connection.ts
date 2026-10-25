import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { sqlite, wrapDatabaseSync, type Db } from './driver';

export type { Db, Statement, RunResult } from './driver';

/**
 * 打开数据库。传 ':memory:' 用于测试。
 * 这里刻意不 import electron —— 默认路径由调用方（main/index.ts）算好后传进来，
 * 这样纯 Node 的单元测试可以直接用内存库。
 */
export function openDatabase(filePath: string): Db {
  if (filePath !== ':memory:') {
    mkdirSync(dirname(filePath), { recursive: true });
  }

  const raw = new sqlite.DatabaseSync(filePath);

  if (filePath !== ':memory:') {
    raw.exec('PRAGMA journal_mode = WAL');
  }
  raw.exec('PRAGMA foreign_keys = ON');

  return wrapDatabaseSync(raw);
}
