import { Router } from 'express';
import fetch from 'node-fetch';
import { pool } from './db.js';
/**
 * Mounts all /api/qbo/* routes
 *
 * index.ts should do:
 *   import { mountQboRoutes } from './qboRoutes.js';
 *   mountQboRoutes(app);
 */
export function mountQboRoutes(app) {
    const router = Router();
    /**
     * GET /api/qbo/status
     * Returns token status used by the QboStatusChip.
     */
    router.get('/status', async (_req, res) => {
        try {
            const { rows } = await pool.query(`
        SELECT
          'quickbooks'::text AS provider,
          integration_id, realm_id,
          access_token, refresh_token,
          expires_at, updated_at
        FROM public.qbo_tokens
        ORDER BY updated_at DESC NULLS LAST, expires_at DESC NULLS LAST
        LIMIT 1
        `);
            if (!rows.length) {
                return res.json({
                    provider: 'quickbooks',
                    hasToken: false,
                    expires_at: null,
                    seconds_until_expiry: 0,
                    realm_id: null,
                    updated_at: null,
                });
            }
            const r = rows[0];
            const now = Date.now();
            const expMs = r.expires_at ? new Date(r.expires_at).getTime() : 0;
            const seconds = Math.max(0, Math.floor((expMs - now) / 1000));
            return res.json({
                provider: 'quickbooks',
                hasToken: Boolean(r.access_token),
                expires_at: r.expires_at ? new Date(r.expires_at).toISOString() : null,
                seconds_until_expiry: seconds,
                realm_id: r.realm_id ?? null,
                updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
            });
        }
        catch (err) {
            console.error('GET /api/qbo/status error:', err);
            return res.status(500).json({ ok: false, error: 'internal_error' });
        }
    });
    /**
     * POST /api/qbo/refresh
     * Exchanges the stored refresh_token for fresh tokens.
     * Requires env: QBO_CLIENT_ID, QBO_CLIENT_SECRET
     */
    router.post('/refresh', async (_req, res) => {
        try {
            const { rows } = await pool.query(`
        SELECT integration_id, realm_id, refresh_token
        FROM public.qbo_tokens
        ORDER BY updated_at DESC NULLS LAST, expires_at DESC NULLS LAST
        LIMIT 1
        `);
            if (!rows.length || !rows[0].refresh_token) {
                return res.status(400).json({ ok: false, error: 'missing_refresh_token' });
            }
            const realmId = rows[0].realm_id ?? '';
            const refreshToken = rows[0].refresh_token;
            const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
            const clientId = process.env.QBO_CLIENT_ID;
            const clientSecret = process.env.QBO_CLIENT_SECRET;
            if (!clientId || !clientSecret) {
                return res.status(500).json({ ok: false, error: 'missing_client_credentials' });
            }
            const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
            const resp = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${basic}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: 'application/json',
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                }).toString(),
            });
            if (!resp.ok) {
                const txt = await resp.text().catch(() => '');
                console.error('QBO refresh failed', resp.status, txt);
                return res.status(502).json({ ok: false, error: 'qbo_refresh_failed', status: resp.status });
            }
            const json = await resp.json();
            const newAccess = json.access_token;
            const newRefresh = json.refresh_token || refreshToken;
            const expiresAt = new Date(Date.now() + json.expires_in * 1000);
            await pool.query(`
        UPDATE public.qbo_tokens
           SET access_token = $1,
               refresh_token = $2,
               expires_at    = $3,
               updated_at    = now()
         WHERE realm_id = $4
        `, [newAccess, newRefresh, expiresAt.toISOString(), realmId]);
            return res.json({ ok: true, realm_id: realmId, expires_at: expiresAt.toISOString() });
        }
        catch (err) {
            console.error('POST /api/qbo/refresh error:', err);
            return res.status(500).json({ ok: false, error: 'internal_error' });
        }
    });
    // (Optional) simple ping—handy for LB health checks
    router.get('/health', (_req, res) => res.json({ ok: true }));
    app.use('/api/qbo', router);
}
