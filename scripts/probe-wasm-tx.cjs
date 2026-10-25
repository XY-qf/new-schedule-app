const { Database } = require('node-sqlite3-wasm');
const db = new Database(':memory:');
const out = {};
db.exec('BEGIN');
db.exec('CREATE TABLE u(a INTEGER)');
db.exec('ROLLBACK');
out.afterDdlRollback = db.all("SELECT name FROM sqlite_master WHERE type='table'");
out.inTx = db.get('SELECT 1 AS x');
try { db.exec('INSERT INTO u VALUES (1)'); out.uExists = true; } catch { out.uExists = false; }
db.close();
console.log('TX_PROBE ' + JSON.stringify(out));