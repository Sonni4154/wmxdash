"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
async function main() {
    // your migration uses gen_random_uuid(); make sure pgcrypto is present
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    const file = (0, path_1.join)(__dirname, '..', 'migrations', '2025-09-17_qbo_init.sql');
    const sql = await (0, promises_1.readFile)(file, 'utf8');
    await pool.query(sql);
    console.log('[migrate] qbo-token-manager migration applied');
}
main().then(() => process.exit(0)).catch(err => {
    console.error('[migrate] failed:', err);
    process.exit(1);
});
