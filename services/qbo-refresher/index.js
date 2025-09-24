/**
 * QBO token refresher (standalone worker)
 * - Reads token row from qbo_tokens
 * - Refreshes when < THRESH seconds left (default 30m)
 * - Persists rotated refresh token
 * - Simple health endpoint on :8081/healthz
 *
 * Node 20+ (global fetch)
 */
import { pool, query } from "./db.js";
import http from "node:http";

const INTUIT_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const CLIENT_ID = process.env.QBO_CLIENT_ID;
const CLIENT_SECRET = process.env.QBO_CLIENT_SECRET;
const REFRESH_THRESHOLD_SECONDS = Number(process.env.REFRESH_THRESHOLD_SECONDS || 1800); // 30m
const TICK_SECONDS = Number(process.env.TICK_SECONDS || 300); // check every 5m
const PORT = Number(process.env.PORT || 8081);

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("[refresher] Missing QBO_CLIENT_ID / QBO_CLIENT_SECRET");
  process.exit(1);
}

function secondsLeft(expiresAtISO) {
  if (!expiresAtISO) return -1;
  return Math.floor((new Date(expiresAtISO).getTime() - Date.now()) / 1000);
}

async function loadTokenRow() {
  const rows = await query(`
    SELECT provider, realm_id, access_token, refresh_token, expires_at
    FROM qbo_tokens
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  return rows[0] || null;
}

async function saveToken({ provider, realm_id, access_token, refresh_token, expires_at }) {
  await query(
    `INSERT INTO qbo_tokens (provider, realm_id, access_token, refresh_token, expires_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,now())
     ON CONFLICT (realm_id)
     DO UPDATE SET access_token=EXCLUDED.access_token,
                   refresh_token=EXCLUDED.refresh_token,
                   expires_at=EXCLUDED.expires_at,
                   updated_at=now()`,
    [provider, realm_id, access_token, refresh_token, expires_at]
  );
}

function basicAuth(id, secret) {
  return Buffer.from(`${id}:${secret}`).toString("base64");
}

let refreshing = false;

async function maybeRefresh() {
  if (refreshing) return;
  const row = await loadTokenRow();
  if (!row) {
    console.warn("[refresher] No qbo_tokens row yet. Waiting for initial OAuth.");
    return;
  }

  const left = secondsLeft(row.expires_at);
  if (left > REFRESH_THRESHOLD_SECONDS && !process.env.FORCE_REFRESH) {
    // Still plenty of time
    return;
  }

  refreshing = true;
  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    });

    const resp = await fetch(INTUIT_TOKEN_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth(CLIENT_ID, CLIENT_SECRET)}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body,
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("[refresher] Refresh failed:", resp.status, text);
      return;
    }

    const j = await resp.json(); // { access_token, refresh_token?, expires_in, ... }
    const newAccess = j.access_token;
    const newRefresh = j.refresh_token || row.refresh_token; // rotate if provided
    const expiresAt = new Date(Date.now() + (j.expires_in * 1000)).toISOString();

    await saveToken({
      provider: "quickbooks",
      realm_id: row.realm_id,
      access_token: newAccess,
      refresh_token: newRefresh,
      expires_at: expiresAt,
    });

    console.log("[refresher] Access token refreshed. Expires in", j.expires_in, "s");
  } catch (e) {
    console.error("[refresher] Error refreshing token:", e);
  } finally {
    refreshing = false;
  }
}

function startLoop() {
  // kick once on boot
  maybeRefresh().catch(() => {});
  // cron-y loop
  setInterval(() => {
    maybeRefresh().catch(() => {});
  }, TICK_SECONDS * 1000).unref();
}

// minimal health endpoint
const server = http.createServer(async (req, res) => {
  if (req.url === "/healthz") {
    try {
      const row = await loadTokenRow();
      const left = row ? secondsLeft(row.expires_at) : -1;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, seconds_left: left, has_token: !!row }));
    } catch (e) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
    }
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`[refresher] health on :${PORT}/healthz`);
  startLoop();
});

process.on("SIGINT", async () => {
  try { await pool.end(); } catch {}
  process.exit(0);
});

