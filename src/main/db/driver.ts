import { Database, type Database as DatabaseType } from 'node-sqlite3-wasm';

export interface RunResult {
  changes: number;
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
 * 把 node-sqlite3-wasm 的 Database 包成仓储层用的统一接口。
 *
 * 为什么不用 node:sqlite：本机 Electron ≥35 启动即崩（0x80000003），
 * 只能用 Electron 33（Node 20，没有 node:sqlite）。WASM 版 SQLite
 * 不需要原生编译、不挑 Electron 版本，代价是性能略低（本项目规模无感）。
 */
export function wrapDatabase(raw: DatabaseType): Db {
  const toParams = (params: unknown[]): never[] =>
    (params.length ? params : []) as never[];

  return {
    prepare(sql) {
      return {
        run: (...params) => raw.run(sql, toParams(params)) as unknown as RunResult,
        get: (...params) => {
          const row = raw.get(sql, toParams(params));
          // node-sqlite3-wasm 在无结果时返回 null，统一成 undefined。
          return row === null ? undefined : row;
        },
        all: (...params) => raw.all(sql, toParams(params)) as unknown[],
      };
    },

    exec(sql) {
      raw.exec(sql);
    },

    pragma(name, opts) {
      if (!PRAGMA_NAME.test(name)) throw new Error(`非法 PRAGMA 名称: ${name}`);
      const row = raw.get(`PRAGMA ${name}`) as Record<string, unknown> | undefined;
      if (!row) return undefined;
      return opts?.simple ? Object.values(row)[0] : row;
    },

    transaction<T>(fn: () => T): T {
      raw.exec('BEGIN');
      try {
        const result = fn();
        raw.exec('COMMIT');
        return result;
      } catch (error) {
        // 回滚本身失败也不能顶掉原始错误——那会让「为什么失败」彻底丢失。
        try {
          raw.exec('ROLLBACK');
        } catch {
          /* 保留原始错误 */
        }
        throw error;
      }
    },

    close() {
      raw.close();
    },
  };
}

export { Database };
