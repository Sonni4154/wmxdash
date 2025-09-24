// apps/server/src/index.ts
import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';

// Routers (ESM-friendly .js extensions; TS rewrites on build)
import dbRoutes from './dbRoutes.js';
import timeRoutes from './timeRoutes.js';
import oauthRouter from './oauth.js';
import { qboRouter } from './qboRoutes.js';  
import webhookRouter from './webhooks.js';

/** fetch with timeout via AbortController (no non-standard RequestInit.timeout) */
async function fetchWithTimeout(url: string, ms: number, init: RequestInit = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

const app = express();

// JSON & cookies
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Mount routers
app.use('/api/db', dbRoutes);
app.use('/api/time', timeRoutes);
app.use('/api/qbo', qboRouter);  
app.use(oauthRouter);
app.use(webhookRouter);

// Simple health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Infra summary (probes internal endpoints with timeouts)
app.get('/api/infra/summary', async (req: Request, res: Response) => {
  const origin = `${req.protocol}://${req.get('host')}`;
  const dbHealthUrl = `${origin}/api/db/health`;
  const qboStatusUrl = `${origin}/api/qbo/status`;

  const out = {
    db: { ok: false, error: null as string | null, data: null as any },
    qbo: { ok: false, error: null as string | null, data: null as any },
  };

  try {
    const r = await fetchWithTimeout(dbHealthUrl, 2000);
    if (!r.ok) throw new Error(`db health HTTP ${r.status}`);
    out.db.data = await r.json();
    out.db.ok = true;
  } catch (e: any) {
    out.db.error = e?.message ?? 'db health fetch failed';
  }

  try {
    const r = await fetchWithTimeout(qboStatusUrl, 2000);
    if (!r.ok) throw new Error(`qbo status HTTP ${r.status}`);
    out.qbo.data = await r.json();
    out.qbo.ok = true;
  } catch (e: any) {
    out.qbo.error = e?.message ?? 'qbo status fetch failed';
  }

  res.json({ ok: out.db.ok && out.qbo.ok, ...out });
});

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});

export default app;

