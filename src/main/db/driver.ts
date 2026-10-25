import { createRequire } from 'node:module';
import type { DatabaseSync, StatementSync } from 'node:sqlite';

/**
 * Vite 5 的内置模块判断不认带前缀的 `node:sqlite`，静态 import 会在测试环境里
 * 被当成 npm 包解析而报错。用 createRequire 在运行时取，绕过静态分析。
 * 类型仍走 `import type`（编译期擦除，不产生运行时依赖）。
 */
const nodeRequire = createRequire(process.execPath);
export const sqlite = nodeRequire('node:sqlite') as typeof import('node:sqlite');

export interface RunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

export interface Statement {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface Db {
  prepare(sql: string): Statement;
  exec(sql: string): void;
  pragma(name: string, opts?: { simple?: boolean }): unknown;
  transaction<T>(fn: () => T): T;
  close(): void;
}

const PRAGMA_NAME = /^[a-z_]+$/i;

/**
 * 把 node:sqlite 的 DatabaseSync 包成仓储层用的统一接口。
 * 换底层（例如退回 better-sqlite3）时只改这一个文件，T6–T8 无感。
 */
export function wrapDatabaseSync(raw: InstanceType<typeof sqlite.DatabaseSync>): Db {
  const cache = new Map<string, StatementSync>();

  const statement = (sql: string): StatementSync => {
    let stmt = cache.get(sql);
    if (!stmt) {
      stmt = raw.prepare(sql);
      cache.set(sql, stmt);
    }
    return stmt;
  };

  return {
    prepare(sql) {
      const stmt = statement(sql);
      return {
        run: (...params) => stmt.run(...(params as never[])) as RunResult,
        get: (...params) => stmt.get(...(params as never[])),
        all: (...params) => stmt.all(...(params as never[])) as unknown[],
      };
    },

    exec(sql) {
      raw.exec(sql);
      cache.clear();
    },

    pragma(name, opts) {
      if (!PRAGMA_NAME.test(name)) throw new Error(`非法 PRAGMA 名称: ${name}`);
      const row = raw.prepare(`PRAGMA ${name}`).get() as Record<string, unknown> | undefined;
      if (!row) return undefined;
      if (opts?.simple) return Object.values(row)[0];
      return row;
    },

    transaction<T>(fn: () => T): T {
      raw.exec('BEGIN');
      try {
        const result = fn();
        raw.exec('COMMIT');
        return result;
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },

    close() {
      cache.clear();
      raw.close();
    },
  };
}