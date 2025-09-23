// apps/server/src/qboClient.ts
import QuickBooks from 'node-quickbooks';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const INTEGRATION_PROVIDER = process.env.INTEGRATION_PROVIDER || 'quickbooks';
// NOTE: org_id is a UUID in the DB; your .env already sets this.
const INTEGRATION_ORG_ID = process.env.INTEGRATION_ORG_ID || '';
const USE_SANDBOX = (process.env.QBO_SANDBOX || 'false').toLowerCase() === 'true';

/** Ensure integrations row exists and return its UUID */
export async function getIntegrationId(): Promise<string> {
  const upsert = await pool.query<{ id: string }>(
    `
    INSERT INTO integrations (provider, org_id)
    VALUES ($1, $2::uuid)
    ON CONFLICT (provider, org_id) DO UPDATE SET updated_at = now()
    RETURNING id
    `,
    [INTEGRATION_PROVIDER, INTEGRATION_ORG_ID]
  );
  return upsert.rows[0].id;
}

/** Get the latest token row for this integration */
async function loadTokens(integrationId: string) {
  const { rows } = await pool.query<{
    access_token: string;
    refresh_token: string;
    realm_id: string;
    expires_at: Date;
  }>(
    `
    SELECT access_token, refresh_token, realm_id, expires_at
    FROM qbo_tokens
    WHERE integration_id = $1
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [integrationId]
  );
  return rows[0] || null;
}

/** Persist newly refreshed tokens from Intuit */
export async function persistTokens(
  integrationId: string,
  data: { access_token: string; refresh_token: string; expires_in: number; realm_id?: string }
) {
  const expires_at = new Date(Date.now() + (Number(data.expires_in ?? 3600) - 60) * 1000);
  await pool.query(
    `
    INSERT INTO qbo_tokens (integration_id, access_token, refresh_token, expires_at, realm_id)
    VALUES ($1, $2, $3, $4, COALESCE($5,''))
    ON CONFLICT (integration_id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at    = EXCLUDED.expires_at,
      realm_id      = COALESCE(EXCLUDED.realm_id, qbo_tokens.realm_id),
      version       = qbo_tokens.version + 1,
      updated_at    = now()
    `,
    [integrationId, data.access_token, data.refresh_token, expires_at, data.realm_id ?? null]
  );
}

/** Build a QuickBooks client using current DB tokens (OAuth 2.0) */
export async function makeQboClient(): Promise<any> {
  const integrationId = await getIntegrationId();
  const tokens = await loadTokens(integrationId);
  if (!tokens) throw new Error('No QBO tokens found. Run /api/qbo/refresh first.');

  const args: any[] = [
    process.env.QBO_CLIENT_ID!,
    process.env.QBO_CLIENT_SECRET!,
    tokens.access_token,
    false,
    tokens.realm_id || INTEGRATION_ORG_ID,
    USE_SANDBOX,
    false,
    null,
    '2.0',
    tokens.refresh_token,
  ];

  const qbo: any = new (QuickBooks as any)(...args);

  // On-demand refresh helper for 401s
  qbo.__refreshOn401 = async (err: any) => {
    const status = err?.status ?? err?.code;
    if (Number(status) !== 401) return qbo;

    const resp = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(`${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token ?? '',
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`QBO token refresh failed: ${resp.status} ${text}`);
    }

    const data = (await resp.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      realmId?: string;
    };

    await persistTokens(integrationId, {
      access_token: data.access_token,
      refresh_token: data.refresh_token || tokens.refresh_token,
      expires_in: data.expires_in,
      realm_id: data.realmId || tokens.realm_id || INTEGRATION_ORG_ID,
    });

    return makeQboClient();
  };

  return qbo;
}

/** Wrapper for list-style queries using node-quickbooks "find*" methods */
export async function qboQuery(entity: string, opts: Record<string, any> = {}): Promise<any> {
  const qbo = await makeQboClient();

  const methodMap: Record<string, string> = {
    customer: 'findCustomers',
    customers: 'findCustomers',
    vendor: 'findVendors',
    vendors: 'findVendors',
    item: 'findItems',
    items: 'findItems',
    invoice: 'findInvoices',
    invoices: 'findInvoices',
    account: 'findAccounts',
    accounts: 'findAccounts',
    payment: 'findPayments',
    payments: 'findPayments',
    estimate: 'findEstimates',
    estimates: 'findEstimates',
    bill: 'findBills',
    bills: 'findBills',
    purchase: 'findPurchases',
    purchases: 'findPurchases',
    journalentry: 'findJournalEntries',
    journalentries: 'findJournalEntries',
    timeactivity: 'findTimeActivities',
    timeactivities: 'findTimeActivities',
  };

  const m = methodMap[entity.toLowerCase()];
  if (!m || typeof (qbo as any)[m] !== 'function') {
    throw new Error(`Unsupported entity for qboQuery: ${entity}`);
  }

  const call = () =>
    new Promise<any>((resolve, reject) => {
      (qbo as any)[m](opts, (err: any, resp: any) => (err ? reject(err) : resolve(resp)));
    });

  try {
    return await call();
  } catch (e: any) {
    const again = await (qbo as any).__refreshOn401?.(e);
    return await new Promise<any>((resolve, reject) => {
      (again as any)[m](opts, (err: any, resp: any) => (err ? reject(err) : resolve(resp)));
    });
  }
}

/** Wrapper for Change Data Capture (CDC) */
export async function qboCDC(entities: string[], sinceISO: string): Promise<any> {
  const qbo = await makeQboClient();

  const call = () =>
    new Promise<any>((resolve, reject) => {
      (qbo as any).changeDataCapture(entities, sinceISO, (err: any, resp: any) =>
        err ? reject(err) : resolve(resp)
      );
    });

  try {
    return await call();
  } catch (e: any) {
    const again = await (qbo as any).__refreshOn401?.(e);
    return await new Promise<any>((resolve, reject) => {
      (again as any).changeDataCapture(entities, sinceISO, (err: any, resp: any) =>
        err ? reject(err) : resolve(resp)
      );
    });
  }
}

