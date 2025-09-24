// apps/server/src/dbRoutes.ts
import { Router, type Request, type Response } from 'express';
import { pool } from './db.js';

const router = Router();

/** GET /api/db/health */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ ok: true, db: 'ok' });
  } catch {
    return res.status(500).json({ ok: false, db: 'down' });
  }
});

// Helpers
function parseLimit(v: unknown, d = 25, max = 200) {
  const n = Math.max(1, Math.min(max, parseInt(String(v ?? d), 10)));
  return Number.isFinite(n) ? n : d;
}
function parseOffset(v: unknown) {
  const n = Math.max(0, parseInt(String(v ?? 0), 10));
  return Number.isFinite(n) ? n : 0;
}

/**
 * GET /api/db/customers?limit=&offset=&q=
 * NOTE: adjust table name if yours differs.
 */
router.get('/customers', async (req: Request, res: Response) => {
  try {
    const limit = parseLimit(req.query.limit);
    const offset = parseOffset(req.query.offset);
    const q = String(req.query.q || '').trim();

    const params: any[] = [];
    let where = '';
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where = `
        WHERE lower(display_name) LIKE $${params.length}
           OR lower(coalesce(given_name, '')) LIKE $${params.length}
           OR lower(coalesce(family_name, '')) LIKE $${params.length}
           OR lower(coalesce(email, '')) LIKE $${params.length}
           OR lower(coalesce(phone, '')) LIKE $${params.length}
      `;
    }

    const totalSql = `SELECT count(*)::int AS c FROM public.qbo_customers ${where}`;
    const { rows: totalRows } = await pool.query<{ c: number }>(totalSql, params);
    const total = totalRows[0]?.c ?? 0;

    params.push(limit, offset);
    const dataSql = `
      SELECT qbo_id, display_name, given_name, family_name, email, phone, active, updated_at
      FROM public.qbo_customers
      ${where}
      ORDER BY updated_at DESC NULLS LAST, display_name ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const { rows } = await pool.query(dataSql, params);

    return res.json({ ok: true, total, limit, offset, data: rows });
  } catch (err) {
    console.error('GET /api/db/customers error:', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

/**
 * GET /api/db/invoices?limit=&offset=&q=
 * NOTE: adjust table name if yours differs.
 */
router.get('/invoices', async (req: Request, res: Response) => {
  try {
    const limit = parseLimit(req.query.limit);
    const offset = parseOffset(req.query.offset);
    const q = String(req.query.q || '').trim();

    const params: any[] = [];
    let where = '';
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where = `
        WHERE lower(coalesce(status,'')) LIKE $${params.length}
           OR lower(coalesce(doc_number,'')) LIKE $${params.length}
           OR lower(coalesce(customer_ref,'')) LIKE $${params.length}
      `;
    }

    const totalSql = `SELECT count(*)::int AS c FROM public.qbo_invoices ${where}`;
    const { rows: totalRows } = await pool.query<{ c: number }>(totalSql, params);
    const total = totalRows[0]?.c ?? 0;

    params.push(limit, offset);
    const dataSql = `
      SELECT
        qbo_id,
        doc_number,
        customer_ref,
        txn_date,
        due_date,
        balance,
        total_amt,
        status,
        updated_at
      FROM public.qbo_invoices
      ${where}
      ORDER BY txn_date DESC NULLS LAST, updated_at DESC NULLS LAST
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const { rows } = await pool.query(dataSql, params);

    return res.json({ ok: true, total, limit, offset, data: rows });
  } catch (err) {
    console.error('GET /api/db/invoices error:', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

/**
 * GET /api/db/items?limit=&offset=&q=
 * NOTE: adjust table name if yours differs.
 */
router.get('/items', async (req: Request, res: Response) => {
  try {
    const limit = parseLimit(req.query.limit);
    const offset = parseOffset(req.query.offset);
    const q = String(req.query.q || '').trim();

    const params: any[] = [];
    let where = '';
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where = `
        WHERE lower(coalesce(name,'')) LIKE $${params.length}
           OR lower(coalesce(type,'')) LIKE $${params.length}
      `;
    }

    const totalSql = `SELECT count(*)::int AS c FROM public.qbo_items ${where}`;
    const { rows: totalRows } = await pool.query<{ c: number }>(totalSql, params);
    const total = totalRows[0]?.c ?? 0;

    params.push(limit, offset);
    const dataSql = `
      SELECT qbo_id, name, type, active, updated_at
      FROM public.qbo_items
      ${where}
      ORDER BY updated_at DESC NULLS LAST, name ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const { rows } = await pool.query(dataSql, params);

    return res.json({ ok: true, total, limit, offset, data: rows });
  } catch (err) {
    console.error('GET /api/db/items error:', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;

