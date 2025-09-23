import { Pool } from 'pg';
import { readFile } from 'fs/promises';
import { join } from 'path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // your migration uses gen_random_uuid(); make sure pgcrypto is present
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

  const file = join(__dirname, '..', 'migrations', '2025-09-17_qbo_init.sql');
  const sql = await readFile(file, 'utf8');

  await pool.query(sql);
  console.log('[migrate] qbo-token-manager migration applied');
}

main().then(() => process.exit(0)).catch(err => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
