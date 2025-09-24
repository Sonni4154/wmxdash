// apps/server/src/oauth.ts
import type { Request, Response } from 'express';
import { Router } from 'express';
import crypto from 'crypto';
import { Pool } from 'pg';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CLIENT_ID = process.env.QBO_CLIENT_ID!;
const CLIENT_SECRET = process.env.QBO_CLIENT_SECRET!;
const REDIRECT_URI = process.env.QBO_REDIRECT_URI || 'http://localhost:3000/quickbooks/callback';
const SCOPE = process.env.QBO_SCOPE || 'com.intuit.quickbooks.accounting';
const QBO_ENV = (process.env.QBO_ENV || 'production').toLowerCase(); // 'sandbox' or 'production'
const AUTH_BASE =
  QBO_ENV === 'sandbox'
    ? 'https://appcenter.intuit.com/connect/oauth2'
    : 'https://appcenter.intuit.com/connect/oauth2'; // same for both; endpoints differ for API, not auth UI.

const INTEGRATION_PROVIDER = process.env.INTEGRATION_PROVIDER || 'quickbooks';
const INTEGRATION_ORG_ID = process.env.INTEGRATION_ORG_ID || 'default-org';

// small cookie helpers (no external session store)
const STATE_COOKIE = 'qbo_oauth_state';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: /^https:/.test(REDIRECT_URI),
  maxAge: 10 * 60 * 1000, // 10 minutes
  path: '/',
};

async function ensureIntegrationId(): Promise<string> {
  const { rows } = await pool.query(
    `
    INSERT INTO integrations (provider, org_id)
    VALUES ($1, $2)
    ON CONFLICT (provider, org_id)
    DO UPDATE SET updated_at = NOW()
    RETURNING id
    `,
    [INTEGRATION_PROVIDER, INTEGRATION_ORG_ID],
  );
  return rows[0].id as string;
}

// Step 1: redirect user to Intuit consent screen
router.get('/api/qbo/connect', async (req: Request, res: Response) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, COOKIE_OPTS);

  const url = new URL(AUTH_BASE);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);

  return res.redirect(url.toString());
});

// Step 2: Intuit redirects here with ?code=&state=&realmId=
router.get('/quickbooks/callback', async (req: Request, res: Response) => {
  try {
    const gotState = String(req.query.state || '');
    const cookieState = req.cookies?.[STATE_COOKIE];
    if (!cookieState || gotState !== cookieState) {
      return res.status(400).send('Invalid state');
    }

    const code = String(req.query.code || '');
    const realmId = String(req.query.realmId || process.env.QBO_REALM_ID || '');
    if (!code || !realmId) {
      return res.status(400).send('Missing code/realmId');
    }

    const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    });

    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('[oauth/callback] Intuit error:', resp.status, text);
      return res.status(resp.status).send('OAuth exchange failed');
    }

    const data = (await resp.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number; // seconds
      x_refresh_token_expires_in?: number;
    };

    const integrationId = await ensureIntegrationId();
    const expires_at = new Date(Date.now() + (Number(data.expires_in || 3600) - 60) * 1000);

    await pool.query(
      `
      INSERT INTO qbo_tokens (integration_id, access_token, refresh_token, expires_at, realm_id)
      VALUES ($1, $2, $3, $4, COALESCE($5,''))
      ON CONFLICT (integration_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at   = EXCLUDED.expires_at,
        realm_id     = COALESCE(EXCLUDED.realm_id, qbo_tokens.realm_id),
        version      = qbo_tokens.version + 1,
        updated_at   = NOW()
      `,
      [integrationId, data.access_token, data.refresh_token, expires_at, realmId],
    );

    // Clear the state cookie
    res.clearCookie(STATE_COOKIE, { ...COOKIE_OPTS, maxAge: 0 });

    // Redirect to dashboard/settings page (adjust as desired)
    return res.redirect('/connected');
  } catch (e: any) {
    console.error('[oauth/callback] error:', e);
    return res.status(500).send('Internal error');
  }
});

export default router;

