// T1 · SQLite 可用性探针：由 Electron 主进程直接执行，打印结论后退出。
// 用法：electron scripts/probe-sqlite.cjs
const out = { node: process.versions.node, electron: process.versions.electron };

try {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec('create table t(a integer)');
  db.prepare('insert into t values (?)').run(1);
  out.nodeSqlite = db.prepare('select count(*) c from t').get().c === 1 ? 'ok' : 'bad';
  db.close();
} catch (e) {
  out.nodeSqlite = 'fail';
  out.nodeSqliteError = String(e.message).split('\n')[0];
}

try {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  out.betterSqlite3 = db.prepare('select sqlite_version() v').get().v ? 'ok' : 'bad';
  db.close();
} catch (e) {
  out.betterSqlite3 = 'fail';
  out.betterSqlite3Error = String(e.message).split('\n')[0];
}

console.log('PROBE ' + JSON.stringify(out));
process.exit(0);
