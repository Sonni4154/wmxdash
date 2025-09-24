import { Router } from 'express';
import { Pool } from 'pg';
import { fetchAllCustomers, fetchAllItems, fetchAllInvoices, getQbo } from './qbo';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Status: show latest token row & realm
router.get('/status', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT access_token, refresh_token, expires_at, realm_id, updated_at
         FROM qbo_tokens
        ORDER BY updated_at DESC
        LIMIT 1`
    );
    res.json({ ok: true, latest: rows[0] || null, realmId: process.env.QBO_REALM_ID || null });
  } catch (e) { next(e); }
});

// Refresh: directly perform a “get access” path that auto-refreshes via your lib code.
// Guard with admin key.
router.post('/refresh', async (req, res, next) => {
  try {
    const adminKey = process.env.ADMIN_API_KEY || '';
    if (adminKey && req.header('x-admin-key') !== adminKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // touching the client ensures refresh flow runs if expired:
    const { qbo, realmId } = await getQbo();
    // Simple no-op call that should succeed with a valid token:
    await new Promise<void>((resolve, reject) => {
      qbo.getCompanyInfo(realmId, (err: any) => (err ? reject(err) : resolve()));
    });
    res.json({ ok: true, realmId });
  } catch (e) { next(e); }
});

// Optional: debugging routes for full pulls (not for prod; rate-limit if kept)
router.post('/pull/customers', async (_req, res, next) => {
  try { const rows = await fetchAllCustomers(); res.json({ ok: true, count: rows.length }); }
  catch (e) { next(e); }
});
router.post('/pull/items', async (_req, res, next) => {
  try { const rows = await fetchAllItems(); res.json({ ok: true, count: rows.length }); }
  catch (e) { next(e); }
});
router.post('/pull/invoices', async (_req, res, next) => {
  try { const rows = await fetchAllInvoices(); res.json({ ok: true, count: rows.length }); }
  catch (e) { next(e); }
});

export default router;

