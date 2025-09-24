
import { Router } from 'express';
import { env } from '../env';
import { query } from '../db';

export const qboRouter = Router();

// Legacy token status (works with qbo_tokens legacy schema)
qboRouter.get('/status', async (_req, res, next) => {
  try {
    const rows = await query<{ id: number; token: string; updated_at: string }>(
      'SELECT id, token, updated_at FROM qbo_tokens ORDER BY updated_at DESC LIMIT 1'
    );
    res.json({ ok: true, latest: rows[0] ?? null, realmId: env.QBO_REALM_ID || null });
  } catch (e) { next(e); }
});

// Manual refresh — guarded by x-admin-key
qboRouter.post('/refresh', async (req, res, next) => {
  try {
    if (env.ADMIN_API_KEY && req.header('x-admin-key') !== env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // NOTE: token manager is an internal process. For now, we simulate by updating the legacy table.
    // Replace this with a function call/import from packages/qbo-token-manager when ready.
    const newToken = `ref_${Date.now()}`;
    const rows = await query<{ id: number }>(
      'INSERT INTO qbo_tokens(token, updated_at) VALUES($1, NOW()) RETURNING id',
      [newToken]
    );
    res.json({ ok: true, id: rows[0].id, note: 'Placeholder refresh; wire token-manager here.' });
  } catch (e) { next(e); }
});

