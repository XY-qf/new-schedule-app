import { beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/main/db/connection';
import { runMigrations } from '../src/main/db/migrate';
import { ensureSeedCategories } from '../src/main/repo/categories';
import { createSchedule } from '../src/main/repo/schedules';
import { backupFileName, backupBeforeRestore, exportBackup } from '../src/main/backup';
import type { Db } from '../src/main/db/driver';

let db: Db;
let dbPath: string;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-todo-bak-'));
  dbPath = join(dir, `app-${randomUUID()}.db`);
  db = openDatabase(dbPath);
  runMigrations(db);
  ensureSeedCategories(db);
});

describe('备份（T36）', () => {
  it('文件名带时间戳', () => {
    const name = backupFileName(new Date(2026, 9, 25, 19, 30));
    expect(name).toBe('ai-todo-backup-20261025-1930.db');
  });

  it('导出的文件存在且非空，并且能读出里面的数据', () => {
    createSchedule(db, {
      title: '备份前的日程',
      categoryId: 'cat-course',
      timeType: 'range',
      isAllDay: false,
      startAt: '2026-10-26T09:00:00',
      endAt: '2026-10-26T10:00:00',
    });

    const targetDir = mkdtempSync(join(tmpdir(), 'ai-todo-bakout-'));
    const file = exportBackup(db, dbPath, targetDir, new Date(2026, 9, 25, 19, 30));

    expect(existsSync(file)).toBe(true);
    expect(file.endsWith('ai-todo-backup-20261025-1930.db')).toBe(true);

    // 用备份文件重新打开，数据要在（证明 wal 已经 checkpoint 进去了）
    const restored = openDatabase(file);
    const rows = restored.prepare('SELECT title FROM schedules').all() as { title: string }[];
    expect(rows.map((r) => r.title)).toContain('备份前的日程');
    restored.close();
  });

  it('导出会先 checkpoint，WAL 里未落盘的数据也在备份中', () => {
    db.exec('PRAGMA journal_mode = WAL');
    createSchedule(db, {
      title: 'WAL 里的日程',
      categoryId: 'cat-course',
      timeType: 'range',
      isAllDay: false,
      startAt: '2026-10-26T11:00:00',
      endAt: '2026-10-26T12:00:00',
    });

    const targetDir = mkdtempSync(join(tmpdir(), 'ai-todo-bakwal-'));
    const file = exportBackup(db, dbPath, targetDir);

    const restored = openDatabase(file);
    const rows = restored.prepare('SELECT title FROM schedules').all() as { title: string }[];
    expect(rows.map((r) => r.title)).toContain('WAL 里的日程');
    restored.close();
  });

  it('恢复前会留一份 pre-restore 备份', () => {
    const file = backupBeforeRestore(db, dbPath, new Date(2026, 9, 25, 20, 0));
    expect(existsSync(file)).toBe(true);
    expect(file).toContain('pre-restore-ai-todo-backup-20261025-2000.db');
  });

  it('目标目录不存在时会自动创建', () => {
    const base = mkdtempSync(join(tmpdir(), 'ai-todo-bakdir-'));
    const nested = join(base, 'a', 'b');
    const file = exportBackup(db, dbPath, nested);
    expect(existsSync(file)).toBe(true);
  });
});
