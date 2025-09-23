// Simple auto-refresher: if <15m left on the token, call the API to refresh.

const API = process.env.API_URL || 'http://api:3000';
const ADMIN_KEY = process.env.ADMIN_API_KEY || '';
const INTERVAL_MS = Number(process.env.REFRESH_INTERVAL_MS || 60_000); // check every 60s
const THRESHOLD_S = Number(process.env.REFRESH_THRESHOLD_S || 900);   // refresh if <15m

async function once() {
  try {
    const stRes = await fetch(`${API}/api/qbo/status`);
    if (!stRes.ok) {
      const text = await stRes.text();
      console.error('[refresher] status failed', stRes.status, text);
      return;
    }
    const st: any = await stRes.json(); // response shape is controlled by our API
    if (!st.hasToken) {
      console.log('[refresher] no token yet');
      return;
    }
    const left = Number(st.seconds_until_expiry ?? 0);
    if (left < THRESHOLD_S) {
      const r = await fetch(`${API}/api/qbo/refresh`, {
        method: 'POST',
        headers: { 'x-admin-key': ADMIN_KEY },
      });
      if (!r.ok) {
        const t = await r.text();
        console.error('[refresher] refresh failed', r.status, t);
      } else {
        console.log('[refresher] refreshed successfully');
      }
    } else {
      console.log(`[refresher] ${left}s left, no action`);
    }
  } catch (e) {
    console.error('[refresher] error', e);
  }
}

async function loop() {
  for (;;) {
    await once();
    await new Promise(r => setTimeout(r, INTERVAL_MS));
  }
}

loop().catch(e => console.error('[refresher] fatal', e));
