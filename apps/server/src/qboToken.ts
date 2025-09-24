// apps/server/src/qboToken.ts
import { query } from './db.js';
import crypto from 'crypto';

const INTUIT_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

type TokenRow = {
  provider: string;
  realm_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO string in PG timestamptz
};

// simple in-process mutex
let refreshing = Promise.resolve<void>(undefined);
let busy = false;

// seconds until access token expires
function secondsLeft(expiresAtISO: string) {
  return Math.floor((new Date(expiresAtISO).getTime() - Date.now()) / 1000);
}

function basicAuth(id: string, secret: string) {
  return Buffer.from(`${id}:${secret}`).toString('base64');
}

async function loadToken(): Promise<TokenRow | null> {
  const rows = await query<TokenRow>(`SELECT provider, realm_id, access_token, refresh_token, expires_at
                                      FROM qbo_tokens ORDER BY updated_at DESC LIMIT 1`);
  return rows[0] || null;
}

async function saveToken(t: TokenRow) {
  await query(
    `INSERT INTO qbo_tokens (provider, realm_id, access_token, refresh_token, expires_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,now())
     ON CONFLICT (realm_id)
     DO UPDATE SET access_token=EXCLUDED.access_token,
                   refresh_token=EXCLUDED.refresh_token,
                   expires_at=EXCLUDED.expires_at,
                   updated_at=now()`,
    [t.provider, t.realm_id, t.access_token, t.refresh_token, t.expires_at]
  );
}

export async function refreshAccessTokenIfNeeded(minSecondsLeft = 300) { // 5 minutes
  if (busy) {
    return refreshing; // someone else is refreshing; let them finish
  }
  const row = await loadToken();
  if (!row) return; // nothing to refresh yet

  if (secondsLeft(row.expires_at) > minSecondsLeft) return; // still good

  // lock
  busy = true;
  refreshing = (async () => {
    try {
      const clientId = process.env.QBO_CLIENT_ID!;
      const clientSecret = process.env.QBO_CLIENT_SECRET!;
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: row.refresh_token,
      });

      const resp = await fetch(INTUIT_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth(clientId, clientSecret)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error('QBO refresh failed:', resp.status, text);
        return;
      }
      const j = await resp.json() as {
        access_token: string;
        refresh_token?: string;          // may rotate!
        expires_in: number;              // seconds
        x_refresh_token_expires_in?: number;
      };

      const newAccess = j.access_token;
      const newRefresh = j.refresh_token ?? row.refresh_token; // rotate if provided
      const expiresAt = new Date(Date.now() + (j.expires_in * 1000)).toISOString();

      await saveToken({
        provider: 'quickbooks',
        realm_id: row.realm_id,
        access_token: newAccess,
        refresh_token: newRefresh,
        expires_at: expiresAt,
      });

      console.log('[qbo] access token refreshed; expires in', j.expires_in, 's');
    } catch (e) {
      console.error('[qbo] refresh error', e);
    } finally {
      busy = false;
    }
  })();

  return refreshing;
}

// A wrapped getter you can use before calling QBO APIs
export async function getAccessToken(): Promise<string | null> {
  await refreshAccessTokenIfNeeded(300);
  const row = await loadToken();
  return row?.access_token ?? null;
}

// background keepalive – call once at boot
export function startQboKeepAlive() {
  // Every 15 minutes, refresh if < 30 minutes left
  setInterval(() => {
    refreshAccessTokenIfNeeded(1800).catch(() => {});
  }, 15 * 60 * 1000).unref();
  console.log('[qbo] keepalive scheduled (15m)');
}

