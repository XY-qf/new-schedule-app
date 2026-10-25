const { Database } = require('node-sqlite3-wasm');
const { rmSync } = require('node:fs');
const path = require('node:path');
const file = path.join(require('node:os').tmpdir(), 'wasm-probe.db');
rmSync(file, { force: true });

const out = {};
const db = new Database(file);

db.exec(`
  CREATE TABLE c (id TEXT PRIMARY KEY, n INTEGER CHECK (n > 0));
  CREATE TABLE t (id TEXT PRIMARY KEY, cid TEXT NOT NULL REFERENCES c(id) ON DELETE RESTRICT);
`);

db.run("INSERT INTO c VALUES ('c1', 1)");
out.getOne = db.get('SELECT * FROM c WHERE id = ?', ['c1']);
out.allRows = db.all('SELECT * FROM c');
out.userVersion0 = db.get('PRAGMA user_version');
db.exec('PRAGMA user_version = 3');
out.userVersion3 = db.get('PRAGMA user_version');

let checkThrew = false;
try { db.run("INSERT INTO c VALUES ('c2', 0)"); } catch { checkThrew = true; }
out.checkEnforced = checkThrew;

let fkThrew = false;
try { db.run("INSERT INTO t VALUES ('t1','nope')"); } catch { fkThrew = true; }
out.fkEnforced = fkThrew;

db.exec('BEGIN');
db.run("INSERT INTO c VALUES ('c3', 5)");
db.exec('ROLLBACK');
out.rollbackWorked = db.all('SELECT * FROM c').length === 1;

db.close();

const db2 = new Database(file);
out.persisted = db2.all('SELECT * FROM c').length === 1;
out.versionAfterReopen = db2.get('PRAGMA user_version');
db2.close();

console.log('WASM_PROBE ' + JSON.stringify(out));