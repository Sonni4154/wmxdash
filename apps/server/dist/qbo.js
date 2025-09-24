// apps/server/src/qbo.ts
import { Pool } from 'pg';
import { createRequire } from 'module';
// Allow requiring CommonJS modules (node-quickbooks) from ESM
const require = createRequire(import.meta.url);
const QuickBooks = require('node-quickbooks');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function ensureIntegrationId() {
    const provider = process.env.INTEGRATION_PROVIDER || 'quickbooks';
    const org = process.env.INTEGRATION_ORG_ID;
    const { rows } = await pool.query(`INSERT INTO integrations (provider, org_id)
     VALUES ($1, $2)
     ON CONFLICT (provider, org_id) DO UPDATE SET updated_at = now()
     RETURNING id`, [provider, org]);
    return rows[0].id;
}
async function latestToken(integrationId) {
    const { rows } = await pool.query(`SELECT access_token, refresh_token, expires_at, realm_id
       FROM qbo_tokens
      WHERE integration_id = $1
      ORDER BY updated_at DESC
      LIMIT 1`, [integrationId]);
    return rows[0] || null;
}
export async function getQbo() {
    const integrationId = await ensureIntegrationId();
    const t = await latestToken(integrationId);
    if (!t)
        throw new Error('no_token_in_db');
    const realmId = t.realm_id || process.env.QBO_REALM_ID;
    const useSandbox = (process.env.QBO_USE_SANDBOX || 'false') === 'true';
    const debug = (process.env.QBO_DEBUG || 'false') === 'true';
    // QuickBooks(consumerKey, consumerSecret, oauth_token, oauth_token_secret(false), realmId,
    //            useSandbox, debug, minorVersion|null, '2.0', refresh_token)
    const qbo = new QuickBooks(process.env.QBO_CLIENT_ID, process.env.QBO_CLIENT_SECRET, t.access_token, false, realmId, useSandbox, debug, 
    // If you ever see 400s about minor version, change null -> '70'
    null, '2.0', t.refresh_token);
    return { qbo, realmId };
}
/* ---------------- Upserts ---------------- */
export async function upsertCustomers(customers) {
    if (!Array.isArray(customers) || customers.length === 0)
        return { inserted: 0, updated: 0 };
    const client = await pool.connect();
    try {
        let ins = 0, upd = 0;
        for (const c of customers) {
            const qbo_id = String(c.Id);
            await client.query(`INSERT INTO qbo_customers
           (qbo_id, display_name, given_name, family_name, email, phone, active, raw)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (qbo_id) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           given_name   = EXCLUDED.given_name,
           family_name  = EXCLUDED.family_name,
           email        = EXCLUDED.email,
           phone        = EXCLUDED.phone,
           active       = EXCLUDED.active,
           raw          = EXCLUDED.raw,
           updated_at   = now()`, [
                qbo_id,
                c.DisplayName || '',
                c.GivenName || null,
                c.FamilyName || null,
                c.PrimaryEmailAddr?.Address || null,
                c.PrimaryPhone?.FreeFormNumber || null,
                Boolean(c.Active),
                c
            ]);
            ins++;
        }
        return { inserted: ins, updated: upd };
    }
    finally {
        client.release();
    }
}
export async function upsertItems(items) {
    if (!Array.isArray(items) || items.length === 0)
        return { upserted: 0 };
    const client = await pool.connect();
    try {
        let n = 0;
        for (const it of items) {
            await client.query(`INSERT INTO qbo_items
           (qbo_id, name, type, active, income_account_ref, expense_account_ref, raw)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (qbo_id) DO UPDATE SET
           name = EXCLUDED.name,
           type = EXCLUDED.type,
           active = EXCLUDED.active,
           income_account_ref = EXCLUDED.income_account_ref,
           expense_account_ref = EXCLUDED.expense_account_ref,
           raw = EXCLUDED.raw,
           updated_at = now()`, [
                String(it.Id),
                it.Name || '',
                it.Type || null,
                Boolean(it.Active),
                it.IncomeAccountRef?.value || null,
                it.ExpenseAccountRef?.value || null,
                it
            ]);
            n++;
        }
        return { upserted: n };
    }
    finally {
        client.release();
    }
}
export async function upsertInvoices(invoices) {
    if (!Array.isArray(invoices) || invoices.length === 0)
        return { upserted: 0 };
    const client = await pool.connect();
    try {
        let n = 0;
        for (const inv of invoices) {
            await client.query(`INSERT INTO qbo_invoices
           (qbo_id, customer_ref, txn_date, due_date, balance, total_amt, status, raw)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (qbo_id) DO UPDATE SET
           customer_ref = EXCLUDED.customer_ref,
           txn_date     = EXCLUDED.txn_date,
           due_date     = EXCLUDED.due_date,
           balance      = EXCLUDED.balance,
           total_amt    = EXCLUDED.total_amt,
           status       = EXCLUDED.status,
           raw          = EXCLUDED.raw,
           updated_at   = now()`, [
                String(inv.Id),
                inv.CustomerRef?.value || null,
                inv.TxnDate || null,
                inv.DueDate || null,
                inv.Balance ?? null,
                inv.TotalAmt ?? null,
                inv.PrivateNote || inv.EmailStatus || null,
                inv
            ]);
            // wipe & re-add invoice lines
            await client.query(`DELETE FROM qbo_invoice_lines WHERE invoice_qbo_id = $1`, [String(inv.Id)]);
            const lines = Array.isArray(inv.Line) ? inv.Line : [];
            let ln = 0;
            for (const L of lines) {
                ln++;
                await client.query(`INSERT INTO qbo_invoice_lines
             (invoice_qbo_id, line_num, item_ref, qty, rate, amount, raw)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
                    String(inv.Id),
                    ln,
                    L.SalesItemLineDetail?.ItemRef?.value || null,
                    L.SalesItemLineDetail?.Qty ?? null,
                    L.SalesItemLineDetail?.UnitPrice ?? null,
                    L.Amount ?? null,
                    L
                ]);
            }
            n++;
        }
        return { upserted: n };
    }
    finally {
        client.release();
    }
}
/* ---------------- SDK wrappers + normalization ---------------- */
function asPromise(fn, ...args) {
    return new Promise((resolve, reject) => {
        fn.call(null, ...args, (e, res) => (e ? reject(e) : resolve(res)));
    });
}
// Normalize node-quickbooks find* responses into arrays.
function pluckArray(resp, key) {
    if (!resp)
        return [];
    if (Array.isArray(resp))
        return resp;
    if (resp.QueryResponse && Array.isArray(resp.QueryResponse[key]))
        return resp.QueryResponse[key];
    if (Array.isArray(resp[key]))
        return resp[key];
    return [];
}
export async function fetchAllCustomers() {
    const { qbo } = await getQbo();
    const resp = await asPromise(qbo.findCustomers.bind(qbo), { fetchAll: true });
    return pluckArray(resp, 'Customer');
}
export async function fetchAllItems() {
    const { qbo } = await getQbo();
    const resp = await asPromise(qbo.findItems.bind(qbo), { fetchAll: true });
    return pluckArray(resp, 'Item');
}
export async function fetchAllInvoices() {
    const { qbo } = await getQbo();
    const resp = await asPromise(qbo.findInvoices.bind(qbo), { fetchAll: true });
    return pluckArray(resp, 'Invoice');
}
// Optional utility used by /api/qbo/company diag
export async function getCompanyInfo() {
    const { qbo, realmId } = await getQbo();
    if (typeof qbo.getCompanyInfo === 'function') {
        return await new Promise((resolve, reject) => {
            qbo.getCompanyInfo(realmId, (err, data) => (err ? reject(err) : resolve(data)));
        });
    }
    // Fallback via SQL query
    const resp = await asPromise(qbo.query.bind(qbo), `SELECT * FROM CompanyInfo`);
    return resp?.QueryResponse?.CompanyInfo?.[0] ?? resp;
}
