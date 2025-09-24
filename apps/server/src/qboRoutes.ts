// apps/server/src/qboRoutes.ts
import { Router, type Request, type Response } from 'express';
import fetch from 'node-fetch';
import { pool } from '../db.js';

export const qboRouter = Router();

type TokenRow = {
  integration_id: string;
  access_token: string | null;
  refresh_token: string | null;
  realm_id: string | null;
  expires_at: string | null; // ISO
  updated_at: string | null;
};

// --- helpers -------------------------------------------------------------

async function getTokenRow(): Promise<TokenRow | null> {
  const { rows } = await pool.query<TokenRow>(
    `SELECT integration_id, access_token, refresh_token, realm_id, expires_at, updated_at
     FROM public.qbo_tokens
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 1`,
  );
  return rows[0] ?? null;
}

function secondsUntilExpiry(expiresAtIso?: string | null): number {
  if (!expiresAtIso) return 0;
  const expires = new Date(expiresAtIso).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((expires - now) / 1000));
}

// --- public status -------------------------------------------------------

qboRouter.get('/status', async (_req,res) => {
  try {
    const row = await getTokenRow();
    const hasToken = Boolean(row?.access_token && row?.expires_at);
    return res.json({
      provider: 'quickbooks',
      hasToken,
      expires_at: row?.expires_at ?? null,
      seconds_until_expiry: secondsUntilExpiry(row?.expires_at ?? null),
      realm_id: row?.realm_id ?? null,
      updated_at: row?.updated_at ?? null,
    });
  } catch (e: any) {
    console.error('[qbo] status error', e?.message || e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// --- secure refresh (cron/pm2) ------------------------------------------

qboRouter.post('/refresh', requireCron, async (req, res) => { 
  try {
    const secret = process.env.QBO_CRON_SECRET || '';
    const headerSecret = req.get('X-Cron-Secret') || req.query.secret || '';
    if (!secret || headerSecret !== secret) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const row = await getTokenRow();
    if (!row?.refresh_token || !row?.realm_id) {
      return res.status(400).json({ error: 'no_refresh_token' });
    }

    // Intuit token endpoint
    const tokenUrl =
      process.env.QBO_TOKEN_URL ||
      'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

    const clientId = process.env.QBO_CLIENT_ID || '';
    const clientSecret = process.env.QBO_CLIENT_SECRET || '';
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const form = new URLSearchParams();
    form.set('grant_type', 'refresh_token');
    form.set('refresh_token', row.refresh_token);

    const r = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: form.toString(),
    });

    const text = await r.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!r.ok) {
      console.error('[qbo] refresh failed', r.status, json);
      return res.status(502).json({ error: 'refresh_failed', status: r.status, body: json });
    }

    const access_token: string = json.access_token;
    const refresh_token: string = json.refresh_token || row.refresh_token;
    const expires_in: number = Number(json.expires_in || 3600);
    const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

    await pool.query(
      `UPDATE public.qbo_tokens
       SET access_token = $1,
           refresh_token = $2,
           expires_at = $3,
           updated_at = now()
       WHERE integration_id = $4`,
      [access_token, refresh_token, expires_at, row.integration_id],
    );

    return res.json({ ok: true, realm_id: row.realm_id, expires_at });
  } catch (e: any) {
    console.error('[qbo] refresh error', e?.message || e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// --- Intuit Webhooks -----------------------------------------------------

// NOTE: If you added a GET verifier handler, keep it here as qboRouter.get(...)

qboRouter.post('/webhooks', async (req: Request, res: Response) => {
  // Your existing webhook verification/handling lives here
  // Keep your HMAC verification + routing logic.
  // This stub just returns 200 OK to avoid 404s during setup.
  try {
    // TODO: verify signature and dispatch events
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('[qbo] webhook error', e?.message || e);
    return res.status(500).json({ error: 'internal_error' });
  }
});


