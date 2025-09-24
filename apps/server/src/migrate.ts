/**
 * Simple migration runner for /sql/*.sql
 * - Creates schema_migrations if not exists
 * - Applies *.sql in lexicographic order, once each
 * - Logs progress then exits 0 on success (non-zero on failure)
 */
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import * as path from 'path';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[migrate] DATABASE_URL not set');
    process.exit(2);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const sqlDir = path.resolve(process.cwd(), 'sql');

  try {
    // Ensure tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // List *.sql files
    let entries: string[] = [];
    try {
      const files = await fs.readdir(sqlDir);
      entries = files.filter(f => f.toLowerCase().endsWith('.sql')).sort();
    } catch {
      console.log('[migrate] no sql directory found, skipping');
      await pool.end();
      process.exit(0);
    }

    // Discover already applied
    const { rows } = await pool.query<{ filename: string }>(
      `SELECT filename FROM schema_migrations`
    );
    const applied = new Set(rows.map(r => r.filename));

    // Apply in order
    for (const fname of entries) {
      if (applied.has(fname)) {
        console.log(`[migrate] skip ${fname} (already applied)`);
        continue;
      }
      const full = path.join(sqlDir, fname);
      const sql = await fs.readFile(full, 'utf8');
      console.log(`[migrate] apply ${fname} ...`);
      try {
        await pool.query('BEGIN');
        await pool.query(sql);
        await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [fname]);
        await pool.query('COMMIT');
        console.log(`[migrate] ok   ${fname}`);
      } catch (e) {
        await pool.query('ROLLBACK');
        console.error(`[migrate] FAIL ${fname}:`, (e as any)?.message || e);
        await pool.end();
        process.exit(1);
      }
    }

    await pool.end();
    console.log('[migrate] done');
    process.exit(0);
  } catch (e) {
    console.error('[migrate] error:', (e as any)?.message || e);
    process.exit(1);
  }
}

main();

