const { Database } = require('node-sqlite3-wasm');
const db = new Database(':memory:');
db.exec('CREATE TABLE t (a INTEGER)');
const r = db.get('SELECT * FROM t WHERE a = 999');
console.log('TYPE:', Array.isArray(r) ? 'array' : typeof r);
console.log('VALUE:', JSON.stringify(r));
console.log('IS_UNDEFINED:', r === undefined);
console.log('KEYS:', r && typeof r === 'object' ? JSON.stringify(Object.keys(r)) : 'n/a');
db.close();