import { Pool } from "pg";
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});
export async function query(sql, params) {
    const res = await pool.query(sql, params);
    return res.rows;
}
