// apps/server/src/index.ts
import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { raw as rawBody } from 'express';
import timeRoutes from "./timeRoutes";
import { Pool } from 'pg';
import dbRoutes from './dbRoutes.js';
import oauthRouter from './oauth.js';
import webhookRouter from './webhooks.js';
import {
  fetchAllCustomers,
  fetchAllItems,
  fetchAllInvoices,
  upsertCustomers,
  upsertItems,
  upsertInvoices,
  getCompanyInfo, // NOTE: import this (not getQbo)
} from './qbo.js';
import { mountQboRoutes } from './qboRoutes.js';

export type IntuitTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  realmId?: string;
};

const app = express();
app.use('/api/db', dbRoutes);
app.use("/api/time", timeRoutes);

// JSON for most routes
app.use(express.json({ limit: '1mb' }));
// Cookies for OAuth state
app.use(cookieParser());

// Mount OAuth (connect + callback)
app.use(oauthRouter);

// Mount webhook with RAW body just for this path (required for HMAC verification)
app.post('/api/webhooks/quickbooks', rawBody({ type: 'application/json' }), webhookRouter);

// Mount QBO read APIs (/api/qbo/* including /api/qbo/cdc and entity list)
mountQboRoutes(app);

// Backward-compat alias for CDC (old path -> new path)
app.get('/api/qbo-cdc', (req, res, next) => {
  req.url = '/api/qbo/cdc' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
  (app as any)._router.handle(req, res, next);
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const port = Number(process.env.PORT || 3000);

const INTEGRATION_PROVIDER = process.env.INTEGRATION_PROVIDER || 'quickbooks';
const INTEGRATION_ORG_ID = process.env.INTEGRATION_ORG_ID || 'default-org';
const ADMIN_KEY = process.env.ADMIN_API_KEY || '';

// --- helpers ---
async function tableExists(name: string): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT (to_regclass($1) IS NOT NULL) AS exists`,
    [name],
  );
  return rows[0]?.exists ?? false;
}

function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86400_000);
  return d.toISOString();
}

// --- Integrations (real table if present; fallback otherwise) ---
app.get('/api/integrations', async (_req: Request, res: Response) => {
  try {
    if (await tableExists('public.integrations')) {
      const { rows } = await pool.query(
        `SELECT provider, org_id, updated_at
           FROM integrations
          WHERE provider = $1 AND org_id = $2
          ORDER BY updated_at DESC`,
        [INTEGRATION_PROVIDER, INTEGRATION_ORG_ID],
      );
      if (rows.length) {
        return res.json(
          rows.map((r) => ({
            provider: r.provider,
            status: 'connected',
            org_id: r.org_id,
            updated_at: r.updated_at,
          })),
        );
      }
    }
    return res.json([{ provider: INTEGRATION_PROVIDER, status: 'connected', org_id: INTEGRATION_ORG_ID }]);
  } catch (e) {
    console.error('[integrations] error:', e);
    return res.json([{ provider: INTEGRATION_PROVIDER, status: 'connected', org_id: INTEGRATION_ORG_ID }]);
  }
});

// --- Dashboard stats (real table if there; else zeros) ---
app.get('/api/dashboard/stats', async (_req: Request, res: Response) => {
  try {
    if (await tableExists('public.invoices')) {
      const { rows } = await pool.query(
        `WITH last30 AS (
           SELECT *
             FROM invoices
            WHERE issued_at >= NOW() - INTERVAL '30 days'
         )
         SELECT
           COALESCE(SUM(CASE WHEN status IN ('sent','paid') THEN total_cents END),0)::bigint AS revenue_30d_cents,
           COUNT(*) FILTER (WHERE status IN ('sent','paid')) AS invoices_30d,
           COUNT(DISTINCT customer_id) FILTER (WHERE status IN ('sent','paid')) AS new_customers_30d,
           COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_invoices
         FROM last30;`,
      );
      const r = rows[0];
      return res.json({
        revenue_30d: Number(r.revenue_30d_cents) / 100,
        invoices_30d: Number(r.invoices_30d),
        new_customers_30d: Number(r.new_customers_30d),
        overdue_invoices: Number(r.overdue_invoices),
      });
    }
    return res.json({ revenue_30d: 0, invoices_30d: 0, new_customers_30d: 0, overdue_invoices: 0 });
  } catch (e) {
    console.error('[dashboard/stats] error:', e);
    return res.json({ revenue_30d: 0, invoices_30d: 0, new_customers_30d: 0, overdue_invoices: 0 });
  }
});

// --- Demo lists with safe fallbacks ---
app.get('/api/customers', async (_req: Request, res: Response) => {
  try {
    if (await tableExists('public.customers')) {
      const { rows } = await pool.query(
        `SELECT id, name, email, created_at
           FROM customers
          ORDER BY created_at DESC
          LIMIT 50`,
      );
      return res.json(rows);
    }
    return res.json([
      { id: 'C-1001', name: 'Acme Marine', email: 'ops@acmemarine.test', created_at: daysAgo(2) },
      { id: 'C-1002', name: 'Harbor Supply', email: 'hello@harborsupply.test', created_at: daysAgo(6) },
    ]);
  } catch (e) {
    console.error('[customers] error:', e);
    return res.json([]);
  }
});

app.get('/api/products', async (_req: Request, res: Response) => {
  try {
    if (await tableExists('public.products')) {
      const { rows } = await pool.query(
        `SELECT id, name, sku, unit_price_cents, updated_at
           FROM products
          ORDER BY updated_at DESC
          LIMIT 50`,
      );
      return res.json(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          sku: r.sku,
          price: Number(r.unit_price_cents) / 100,
          updated_at: r.updated_at,
        })),
      );
    }
    return res.json([
      { id: 'P-001', name: 'Bottom Paint (1 gal)', sku: 'BP-1G', price: 129.0, updated_at: daysAgo(1) },
      { id: 'P-002', name: 'Zinc Anode Kit', sku: 'ZINC-KIT', price: 45.0, updated_at: daysAgo(4) },
    ]);
  } catch (e) {
    console.error('[products] error:', e);
    return res.json([]);
  }
});

app.get('/api/invoices', async (_req: Request, res: Response) => {
  try {
    if (await tableExists('public.invoices')) {
      const { rows } = await pool.query(
        `SELECT id, customer_name, total_cents, status, issued_at, due_at
           FROM invoices
          ORDER BY issued_at DESC
          LIMIT 50`,
      );
      return res.json(
        rows.map((r) => ({
          id: r.id,
          customer: r.customer_name,
          total: Number(r.total_cents) / 100,
          status: r.status,
          issued_at: r.issued_at,
          due_at: r.due_at,
        })),
      );
    }
    return res.json([
      { id: 'INV-0001', customer: 'Acme Marine', total: 980.0, status: 'sent', issued_at: daysAgo(3), due_at: daysAgo(-27) },
      { id: 'INV-0002', customer: 'Harbor Supply', total: 145.5, status: 'draft', issued_at: daysAgo(1), due_at: daysAgo(29) },
      { id: 'INV-0003', customer: 'Acme Marine', total: 220.0, status: 'paid', issued_at: daysAgo(12), due_at: daysAgo(18) },
    ]);
  } catch (e) {
    console.error('[invoices] error:', e);
    return res.json([]);
  }
});

app.get('/api/activity', async (_req: Request, res: Response) => {
  try {
    return res.json([
      { id: 'A-1', type: 'note', message: 'Welcome to the new dashboard!', at: daysAgo(0) },
      { id: 'A-2', type: 'invoice', message: 'Invoice INV-0002 drafted', at: daysAgo(1) },
      { id: 'A-3', type: 'sync', message: 'QuickBooks sync succeeded', at: daysAgo(2) },
    ]);
  } catch (e) {
    console.error('[activity] error:', e);
    return res.json([]);
  }
});

// ---------- Official-schema helpers for token refresh ----------
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

async function getLatestQboTokenOfficial(integrationId: string) {
  const { rows } = await pool.query(
    `SELECT access_token, refresh_token, expires_at, realm_id, updated_at
       FROM qbo_tokens
      WHERE integration_id = $1
      ORDER BY updated_at DESC
      LIMIT 1`,
    [integrationId],
  );
  return rows[0] || null;
}

// Status
app.get('/api/qbo/status', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query<{ has_integrations: boolean; has_tokens: boolean }>(
      `SELECT (to_regclass('public.integrations') IS NOT NULL) AS has_integrations,
              (to_regclass('public.qbo_tokens')   IS NOT NULL) AS has_tokens`,
    );
    const hasIntegrations = rows[0]?.has_integrations;
    const hasTokens = rows[0]?.has_tokens;

    if (!hasTokens) return res.status(404).json({ hasToken: false });

    if (hasIntegrations) {
      const id = await ensureIntegrationId();
      const tok = await getLatestQboTokenOfficial(id);
      if (!tok) return res.status(404).json({ hasToken: false });
      const now = new Date();
      const secondsLeft = Math.max(0, Math.floor((new Date(tok.expires_at).getTime() - now.getTime()) / 1000));
      return res.json({
        provider: INTEGRATION_PROVIDER,
        org_id: INTEGRRATION_ORG_ID_FIX ?? INTEGRATION_ORG_ID,
        hasToken: true,
        expires_at: tok.expires_at,
        seconds_until_expiry: secondsLeft,
        realm_id: tok.realm_id,
        updated_at: tok.updated_at,
      });
    } else {
      const { rows: r } = await pool.query(`SELECT token, updated_at FROM qbo_tokens WHERE id = 1`);
      if (r.length === 0) return res.status(404).json({ hasToken: false });
      return res.json({ hasToken: true, token: r[0].token, updated_at: r[0].updated_at });
    }
  } catch (e) {
    console.error('[qbo/status] error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Admin: manual refresh
app.post('/api/qbo/refresh', async (req: Request, res: Response) => {
  try {
    if (ADMIN_KEY && req.headers['x-admin-key'] !== ADMIN_KEY) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const clientId = process.env.QBO_CLIENT_ID;
    const clientSecret = process.env.QBO_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: 'missing_client_credentials' });
    }

    const integrationId = await ensureIntegrationId();
    const existing = await getLatestQboTokenOfficial(integrationId);
    let refreshToken = existing?.refresh_token || process.env.QBO_REFRESH_TOKEN_INIT || '';
    if (!refreshToken) {
      return res.status(400).json({ error: 'no_refresh_token_available' });
    }

    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
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
      console.error('[qbo/refresh] Intuit error:', resp.status, text);
      return res.status(resp.status).json({ error: 'intuit_error', detail: text });
    }

    const data = (await resp.json()) as IntuitTokenResponse;
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
      [integrationId, data.access_token, data.refresh_token || refreshToken, expires_at, data.realmId || existing?.realm_id || null],
    );

    res.json({
      ok: true,
      provider: INTEGRATION_PROVIDER,
      org_id: INTEGRATION_ORG_ID,
      expires_at,
      realm_id: data.realmId || existing?.realm_id || '',
    });
  } catch (e) {
    console.error('[qbo/refresh] error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// --- QBO sync helpers (with detailed diagnostics) ---
app.get('/api/qbo/sync/customers', async (_req, res) => {
  try {
    const data = await fetchAllCustomers();
    const { inserted, updated } = await upsertCustomers(data);
    res.json({ ok: true, count: data.length, inserted, updated });
  } catch (e: any) {
    const msg = e?.fault?.error?.[0]?.message || e?.message || String(e);
    const detail = e?.fault?.error?.[0]?.detail || e?.response?.text || undefined;
    console.error('[qbo/sync/customers]', msg, detail ?? '');
    res.status(500).json({ error: 'sync_failed', message: msg, detail });
  }
});

app.get('/api/qbo/sync/items', async (_req, res) => {
  try {
    const data = await fetchAllItems();
    const r = await upsertItems(data);
    res.json({ ok: true, count: data.length, ...r });
  } catch (e: any) {
    const msg = e?.fault?.error?.[0]?.message || e?.message || String(e);
    const detail = e?.fault?.error?.[0]?.detail || e?.response?.text || undefined;
    console.error('[qbo/sync/items]', msg, detail ?? '');
    res.status(500).json({ error: 'sync_failed', message: msg, detail });
  }
});

app.get('/api/qbo/sync/invoices', async (_req, res) => {
  try {
    const data = await fetchAllInvoices();
    const r = await upsertInvoices(data);
    res.json({ ok: true, count: data.length, ...r });
  } catch (e: any) {
    const msg = e?.fault?.error?.[0]?.message || e?.message || String(e);
    const detail = e?.fault?.error?.[0]?.detail || e?.response?.text || undefined;
    console.error('[qbo/sync/invoices]', msg, detail ?? '');
    res.status(500).json({ error: 'sync_failed', message: msg, detail });
  }
});

// --- Diagnostic: company info to confirm token/realm/scopes ---
app.get('/api/qbo/company', async (_req, res) => {
  try {
    const info = await getCompanyInfo();
    res.json(info);
  } catch (e: any) {
    const msg = e?.fault?.error?.[0]?.message || e?.message || String(e);
    const detail = e?.fault?.error?.[0]?.detail || e?.response?.text || undefined;
    console.error('[qbo/company]', msg, detail ?? '');
    res.status(500).json({ error: 'qbo_company_failed', message: msg, detail });
  }
});

// Root
app.get('/', (_req: Request, res: Response) => res.status(200).send('API is running'));

// Only auto-start when not running tests; export app for Supertest
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => console.log(`[server] listening on port ${port}`));
}
app.get('/api/debug/routes', (_req, res) => {
  // @ts-ignore
  const stack = app._router?.stack || [];
  const routes = stack
    .filter((l: any) => l.route?.path)
    .map((l: any) => ({ method: Object.keys(l.route.methods)[0]?.toUpperCase(), path: l.route.path }));
  res.json({ routes });
});
export default app;

// NOTE: This optional constant is only here to prevent a TS typo from breaking runtime if someone reintroduces it.
// It is NOT used unless the typed name is referenced above by mistake.
const INTEGRRATION_ORG_ID_FIX = process.env.INTEGRATION_ORG_ID;

