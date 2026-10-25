import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Database, wrapDatabase, type Db } from './driver';

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

  const raw = new Database(filePath);

  if (filePath !== ':memory:') {
    try {
      raw.exec('PRAGMA journal_mode = WAL');
    } catch {
      // WASM 虚拟文件系统可能不支持 WAL，退回默认日志模式即可。
    }
  }
  raw.exec('PRAGMA foreign_keys = ON');

  return wrapDatabase(raw);
}
