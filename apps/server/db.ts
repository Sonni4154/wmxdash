import { Pool } from 'pg';
import { env } from './env';

export const pool = new Pool({ connectionString: env.DATABASE_URL });

export async function query<T = any>(text: string, params?: any[]) {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

