import { Router } from "express";
import { pool } from "./db.js";

const router = Router();

// small helper to coerce & clamp
function num(v: any, d: number, min = 0, max = 10_000) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (Number.isNaN(n)) return d;
  return Math.max(min, Math.min(max, n));
}

/**
 * GET /api/db/customers?limit=20&offset=0&q=zor
 */
router.get("/customers", async (req, res) => {
  try {
    const limit = num(req.query.limit, 20, 1, 200);
    const offset = num(req.query.offset, 0, 0, 100_000);
    const q = String(req.query.q ?? "").trim();

    const where = q
      ? `WHERE LOWER(display_name) LIKE LOWER($1) OR LOWER(email) LIKE LOWER($1)`
      : "";
    const args = q ? [`%${q}%`, limit, offset] : [limit, offset];

    const dataSql = `
      SELECT qbo_id, display_name, given_name, family_name, email, phone, active, updated_at
      FROM qbo_customers
      ${where ? " " + where : ""}
      ORDER BY updated_at DESC
      LIMIT $${where ? 2 : 1} OFFSET $${where ? 3 : 2};
    `;
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM qbo_customers
      ${where ? " " + where : ""};
    `;

    const [dataRes, countRes] = await Promise.all([
      pool.query(dataSql, args),
      pool.query(countSql, where ? [args[0]] : []),
    ]);

    res.json({
      ok: true,
      total: countRes.rows[0]?.total ?? 0,
      limit,
      offset,
      data: dataRes.rows,
    });
  } catch (e) {
    console.error("GET /db/customers", e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * GET /api/db/invoices?limit=20&offset=0&q=513
 * (q searches by customer_ref or doc_number loosely)
 */
router.get("/invoices", async (req, res) => {
  try {
    const limit = num(req.query.limit, 20, 1, 200);
    const offset = num(req.query.offset, 0);
    const q = String(req.query.q ?? "").trim();

    const where = q
      ? `WHERE doc_number ILIKE $1 OR customer_ref::text ILIKE $1`
      : "";
    const args = q ? [`%${q}%`, limit, offset] : [limit, offset];

    const dataSql = `
      SELECT qbo_id, doc_number, customer_ref, txn_date, due_date, balance, total_amt, status, updated_at
      FROM qbo_invoices
      ${where ? " " + where : ""}
      ORDER BY txn_date DESC NULLS LAST, updated_at DESC
      LIMIT $${where ? 2 : 1} OFFSET $${where ? 3 : 2};
    `;
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM qbo_invoices
      ${where ? " " + where : ""};
    `;

    const [dataRes, countRes] = await Promise.all([
      pool.query(dataSql, args),
      pool.query(countSql, where ? [args[0]] : []),
    ]);

    res.json({
      ok: true,
      total: countRes.rows[0]?.total ?? 0,
      limit,
      offset,
      data: dataRes.rows,
    });
  } catch (e) {
    console.error("GET /db/invoices", e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * GET /api/db/items?limit=20&offset=0&q=tyvek
 */
router.get("/items", async (req, res) => {
  try {
    const limit = num(req.query.limit, 20, 1, 200);
    const offset = num(req.query.offset, 0);
    const q = String(req.query.q ?? "").trim();

    const where = q ? `WHERE name ILIKE $1` : "";
    const args = q ? [`%${q}%`, limit, offset] : [limit, offset];

    const dataSql = `
      SELECT qbo_id, name, type, active, updated_at
      FROM qbo_items
      ${where ? " " + where : ""}
      ORDER BY updated_at DESC
      LIMIT $${where ? 2 : 1} OFFSET $${where ? 3 : 2};
    `;
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM qbo_items
      ${where ? " " + where : ""};
    `;

    const [dataRes, countRes] = await Promise.all([
      pool.query(dataSql, args),
      pool.query(countSql, where ? [args[0]] : []),
    ]);

    res.json({
      ok: true,
      total: countRes.rows[0]?.total ?? 0,
      limit,
      offset,
      data: dataRes.rows,
    });
  } catch (e) {
    console.error("GET /db/items", e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

export default router;
