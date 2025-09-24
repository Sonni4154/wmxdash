import { Router, Request, Response } from "express";
import { pool } from "../db.js";

// Prefer importing a shared pool if you already have one in ../db
let pool: Pool;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const shared = require("../db");
  if (shared?.pool) {
    pool = shared.pool as Pool;
  }
} catch {}
if (!pool) {
  pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      `postgresql://${process.env.PGUSER || "postgres"}:${process.env.PGPASSWORD || ""}@${process.env.PGHOST || "127.0.0.1"}:${process.env.PGPORT || "5432"}/${process.env.PGDATABASE || "wmx"}`,
    ssl:
      process.env.PGSSLMODE === "require"
        ? { rejectUnauthorized: false }
        : undefined,
  });
}

function intParam(v: any, def: number, min = 0, max = 1000) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (Number.isNaN(n)) return def;
  return Math.min(Math.max(n, min), max);
}

const router = Router();

/**
 * GET /api/db/customers?limit=50&offset=0&q=foo
 * Shape the fields to match the frontend’s expectation.
 */
router.get("/customers", async (req: Request, res: Response) => {
  const limit = intParam(req.query.limit, 50, 1, 500);
  const offset = intParam(req.query.offset, 0, 0, 100_000);
  const q = (req.query.q as string | undefined)?.trim();

  const where = q
    ? `
      WHERE
        (display_name ILIKE $3 OR
         COALESCE(given_name, '') ILIKE $3 OR
         COALESCE(family_name, '') ILIKE $3 OR
         COALESCE(email, '') ILIKE $3 OR
         COALESCE(phone, '') ILIKE $3)
    `
    : "";

  const params: any[] = [limit, offset];
  if (q) params.push(`%${q}%`);

  try {
    const totalSql = `SELECT COUNT(*)::int AS n FROM qbo_customers ${where}`;
    const total = (await pool.query(totalSql, q ? [params[2]] : [])).rows[0]?.n ?? 0;

    const dataSql = `
      SELECT
        qbo_id,
        display_name,
        given_name,
        family_name,
        email,
        phone,
        active,
        updated_at
      FROM qbo_customers
      ${where}
      ORDER BY updated_at DESC NULLS LAST
      LIMIT $1 OFFSET $2
    `;
    const dataRows = (await pool.query(dataSql, params)).rows;

    res.json({ ok: true, total, limit, offset, data: dataRows });
  } catch (err: any) {
    console.error("[db] customers error", err);
    res.status(500).json({ error: "db_error", detail: err?.message || String(err) });
  }
});

/**
 * GET /api/db/products?limit=50&offset=0&q=foo
 */
router.get("/products", async (req: Request, res: Response) => {
  const limit = intParam(req.query.limit, 50, 1, 500);
  const offset = intParam(req.query.offset, 0, 0, 100_000);
  const q = (req.query.q as string | undefined)?.trim();

  const where = q ? `WHERE (name ILIKE $3 OR COALESCE(type,'') ILIKE $3)` : "";
  const params: any[] = [limit, offset];
  if (q) params.push(`%${q}%`);

  try {
    const totalSql = `SELECT COUNT(*)::int AS n FROM qbo_items ${where}`;
    const total = (await pool.query(totalSql, q ? [params[2]] : [])).rows[0]?.n ?? 0;

    const dataSql = `
      SELECT
        qbo_id,
        name,
        type,
        active,
        updated_at
      FROM qbo_items
      ${where}
      ORDER BY updated_at DESC NULLS LAST
      LIMIT $1 OFFSET $2
    `;
    const dataRows = (await pool.query(dataSql, params)).rows;

    res.json({ ok: true, total, limit, offset, data: dataRows });
  } catch (err: any) {
    console.error("[db] products error", err);
    res.status(500).json({ error: "db_error", detail: err?.message || String(err) });
  }
});

/**
 * GET /api/db/invoices?limit=50&offset=0&q=foo
 */
router.get("/invoices", async (req: Request, res: Response) => {
  const limit = intParam(req.query.limit, 50, 1, 500);
  const offset = intParam(req.query.offset, 0, 0, 100_000);
  const q = (req.query.q as string | undefined)?.trim();

  // Filter by doc_number or customer display_name if you have a FK; fallback to doc_number only
  const where = q ? `WHERE (COALESCE(doc_number,'') ILIKE $3)` : "";
  const params: any[] = [limit, offset];
  if (q) params.push(`%${q}%`);

  try {
    const totalSql = `SELECT COUNT(*)::int AS n FROM qbo_invoices ${where}`;
    const total = (await pool.query(totalSql, q ? [params[2]] : [])).rows[0]?.n ?? 0;

    const dataSql = `
      SELECT
        qbo_id,
        doc_number,
        customer_ref,
        total_amt,
        balance,
        txn_date,
        status,
        updated_at
      FROM qbo_invoices
      ${where}
      ORDER BY COALESCE(txn_date, updated_at) DESC NULLS LAST
      LIMIT $1 OFFSET $2
    `;
    const dataRows = (await pool.query(dataSql, params)).rows;

    res.json({ ok: true, total, limit, offset, data: dataRows });
  } catch (err: any) {
    console.error("[db] invoices error", err);
    res.status(500).json({ error: "db_error", detail: err?.message || String(err) });
  }
});

export default router;

