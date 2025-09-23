// apps/server/src/qboUpsert.ts
import { Pool } from 'pg';
import { getIntegrationId } from './qboClient.js'; // add & export this in qboClient.ts

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function upsertCustomers(rows: Array<Record<string, any>>) {
  if (!rows.length) return { inserted: 0, updated: 0 };
  const integrationId = await getIntegrationId();
  const text = `
    INSERT INTO qbo_customers
      (integration_id, qbo_id, display_name, given_name, family_name, email, phone,
       active, created_at_utc, updated_at_utc, raw)
    VALUES ${rows.map((_, i) =>
      `($1, $${i*10+2}, $${i*10+3}, $${i*10+4}, $${i*10+5}, $${i*10+6}, $${i*10+7}, $${i*10+8}, $${i*10+9}, $${i*10+10}, $${i*10+11})`
    ).join(',')}
    ON CONFLICT (integration_id, qbo_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      given_name   = EXCLUDED.given_name,
      family_name  = EXCLUDED.family_name,
      email        = EXCLUDED.email,
      phone        = EXCLUDED.phone,
      active       = EXCLUDED.active,
      created_at_utc = COALESCE(EXCLUDED.created_at_utc, qbo_customers.created_at_utc),
      updated_at_utc = EXCLUDED.updated_at_utc,
      raw          = EXCLUDED.raw,
      updated_at   = now();
  `;
  const params: any[] = [integrationId];
  rows.forEach(r => {
    params.push(
      r.qbo_id, r.display_name, r.given_name, r.family_name, r.email, r.phone,
      r.active, r.created_at_utc, r.updated_at_utc, r.raw
    );
  });
  await pool.query(text, params);
  return { inserted: rows.length, updated: 'conflict-handled' };
}

export async function upsertItems(rows: Array<Record<string, any>>) {
  if (!rows.length) return { inserted: 0, updated: 0 };
  const integrationId = await getIntegrationId();
  const text = `
    INSERT INTO qbo_items
      (integration_id, qbo_id, name, active, type, sku, unit_price,
       income_account_ref, expense_account_ref, asset_account_ref,
       created_at_utc, updated_at_utc, raw)
    VALUES ${rows.map((_, i) =>
      `($1, $${i*13+2}, $${i*13+3}, $${i*13+4}, $${i*13+5}, $${i*13+6}, $${i*13+7}, $${i*13+8}, $${i*13+9}, $${i*13+10}, $${i*13+11}, $${i*13+12}, $${i*13+13})`
    ).join(',')}
    ON CONFLICT (integration_id, qbo_id) DO UPDATE SET
      name = EXCLUDED.name,
      active = EXCLUDED.active,
      type = EXCLUDED.type,
      sku = EXCLUDED.sku,
      unit_price = EXCLUDED.unit_price,
      income_account_ref = EXCLUDED.income_account_ref,
      expense_account_ref = EXCLUDED.expense_account_ref,
      asset_account_ref = EXCLUDED.asset_account_ref,
      created_at_utc = COALESCE(EXCLUDED.created_at_utc, qbo_items.created_at_utc),
      updated_at_utc = EXCLUDED.updated_at_utc,
      raw = EXCLUDED.raw,
      updated_at = now();
  `;
  const params: any[] = [integrationId];
  rows.forEach(r => {
    params.push(
      r.qbo_id, r.name, r.active, r.type, r.sku, r.unit_price,
      r.income_account_ref, r.expense_account_ref, r.asset_account_ref,
      r.created_at_utc, r.updated_at_utc, r.raw
    );
  });
  await pool.query(text, params);
  return { inserted: rows.length, updated: 'conflict-handled' };
}

export async function upsertInvoices(invoices: Array<Record<string, any>>, linesByInvoice: Array<Array<Record<string, any>>>) {
  const integrationId = await getIntegrationId();
  // Invoices
  if (invoices.length) {
    const text = `
      INSERT INTO qbo_invoices
        (integration_id, qbo_id, doc_number, txn_date, customer_ref, total_amt, balance, currency,
         created_at_utc, updated_at_utc, raw)
      VALUES ${invoices.map((_, i) =>
        `($1, $${i*11+2}, $${i*11+3}, $${i*11+4}, $${i*11+5}, $${i*11+6}, $${i*11+7}, $${i*11+8}, $${i*11+9}, $${i*11+10}, $${i*11+11})`
      ).join(',')}
      ON CONFLICT (integration_id, qbo_id) DO UPDATE SET
        doc_number = EXCLUDED.doc_number,
        txn_date = EXCLUDED.txn_date,
        customer_ref = EXCLUDED.customer_ref,
        total_amt = EXCLUDED.total_amt,
        balance = EXCLUDED.balance,
        currency = EXCLUDED.currency,
        created_at_utc = COALESCE(EXCLUDED.created_at_utc, qbo_invoices.created_at_utc),
        updated_at_utc = EXCLUDED.updated_at_utc,
        raw = EXCLUDED.raw,
        updated_at = now();`;
    const params: any[] = [integrationId];
    invoices.forEach(inv => {
      params.push(
        inv.qbo_id, inv.doc_number, inv.txn_date, inv.customer_ref, inv.total_amt, inv.balance,
        inv.currency, inv.created_at_utc, inv.updated_at_utc, inv.raw
      );
    });
    await pool.query(text, params);
  }

  // Lines (replace-all per invoice to keep it simple)
  for (const lines of linesByInvoice) {
    if (!lines.length) continue;
    const invId = lines[0].invoice_qbo_id;
    await pool.query(
      `DELETE FROM qbo_invoice_lines WHERE integration_id = $1 AND invoice_qbo_id = $2`,
      [integrationId, invId]
    );
    const text =
      `INSERT INTO qbo_invoice_lines
         (integration_id, invoice_qbo_id, line_no, amount, detail_type, item_ref, qty, unit_price, tax_code_ref, raw)
       VALUES ${lines.map((_, i) =>
         `($1, $${i*9+2}, $${i*9+3}, $${i*9+4}, $${i*9+5}, $${i*9+6}, $${i*9+7}, $${i*9+8}, $${i*9+9}, $${i*9+10})`
       ).join(',')}`;
    const params: any[] = [integrationId];
    lines.forEach(l => {
      params.push(
        l.invoice_qbo_id, l.line_no, l.amount, l.detail_type, l.item_ref, l.qty, l.unit_price, l.tax_code_ref, l.raw
      );
    });
    await pool.query(text, params);
  }

  return { ok: true };
}

