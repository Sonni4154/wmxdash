import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

/**
 * Helpers
 */
function parseLimitOffset(qs: any) {
  const limit = Math.max(1, Math.min(100, Number(qs.limit ?? 25) || 25));
  const offset = Math.max(0, Number(qs.offset ?? 0) || 0);
  return { limit, offset };
}

/**
 * GET /api/db/customers
 * ?limit=&offset=&q=
 * Response: { ok, total, limit, offset, data: [ ... ] }
 */
router.get("/customers", async (req, res) => {
  try {
    const { limit, offset } = parseLimitOffset(req.query);
    const q = String(req.query.q ?? "").trim();

    const where = q
      ? `WHERE (display_name ILIKE $1 OR given_name ILIKE $1 OR family_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)`
      : "";
    const params: any[] = [];
    if (q) params.push(`%${q}%`);

    const countSql = `SELECT COUNT(*)::int AS c FROM qbo_customers ${where}`;
    const { rows: cr } = await pool.query<{ c: number }>(countSql, params);
    const total = cr[0]?.c ?? 0;

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
      ORDER BY updated_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const { rows } = await pool.query(
      dataSql,
      params.concat([limit, offset])
    );

    return res.json({ ok: true, total, limit, offset, data: rows });
  } catch (err: any) {
    console.error("GET /db/customers error", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * GET /api/db/invoices
 * ?limit=&offset=&q=
 */
router.get("/invoices", async (req, res) => {
  try {
    const { limit, offset } = parseLimitOffset(req.query);
    const q = String(req.query.q ?? "").trim();

    const where = q
      ? `WHERE (doc_number ILIKE $1 OR status ILIKE $1)`
      : "";
    const params: any[] = [];
    if (q) params.push(`%${q}%`);

    const countSql = `SELECT COUNT(*)::int AS c FROM qbo_invoices ${where}`;
    const { rows: cr } = await pool.query<{ c: number }>(countSql, params);
    const total = cr[0]?.c ?? 0;

    const dataSql = `
      SELECT
        qbo_id,
        doc_number,
        customer_ref,          -- may be text or JSON depending on your migration
        txn_date,
        due_date,
        balance,
        total_amt,
        status,
        updated_at
      FROM qbo_invoices
      ${where}
      ORDER BY txn_date DESC NULLS LAST, updated_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const { rows } = await pool.query(
      dataSql,
      params.concat([limit, offset])
    );

    return res.json({ ok: true, total, limit, offset, data: rows });
  } catch (err: any) {
    console.error("GET /db/invoices error", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * GET /api/db/items
 * ?limit=&offset=&q=
 */
router.get("/items", async (req, res) => {
  try {
    const { limit, offset } = parseLimitOffset(req.query);
    const q = String(req.query.q ?? "").trim();

    const where = q ? `WHERE (name ILIKE $1 OR type ILIKE $1)` : "";
    const params: any[] = [];
    if (q) params.push(`%${q}%`);

    const countSql = `SELECT COUNT(*)::int AS c FROM qbo_items ${where}`;
    const { rows: cr } = await pool.query<{ c: number }>(countSql, params);
    const total = cr[0]?.c ?? 0;

    const dataSql = `
      SELECT
        qbo_id,
        name,
        type,
        active,
        updated_at
      FROM qbo_items
      ${where}
      ORDER BY updated_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const { rows } = await pool.query(
      dataSql,
      params.concat([limit, offset])
    );

    return res.json({ ok: true, total, limit, offset, data: rows });
  } catch (err: any) {
    console.error("GET /db/items error", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

export default router;

