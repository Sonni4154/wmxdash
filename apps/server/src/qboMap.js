import type { QueryResultRow } from 'pg';

export function mapCustomer(c: any) {
  const md = c.MetaData || {};
  return {
    id: String(c.Id),
    display_name: c.DisplayName ?? '',
    given_name: c.GivenName ?? null,
    family_name: c.FamilyName ?? null,
    company_name: c.CompanyName ?? null,
    primary_email: c.PrimaryEmailAddr?.Address ?? null,
    active: c.Active !== false,
    sync_token: c.SyncToken ?? null,
    created_at_qbo: md.CreateTime ? new Date(md.CreateTime) : null,
    updated_at_qbo: md.LastUpdatedTime ? new Date(md.LastUpdatedTime) : null,
  };
}

export function mapItem(i: any) {
  const md = i.MetaData || {};
  return {
    id: String(i.Id),
    name: i.Name ?? '',
    active: i.Active !== false,
    type: i.Type ?? null,
    income_account: i.IncomeAccountRef?.name ?? null,
    expense_account: i.ExpenseAccountRef?.name ?? null,
    sync_token: i.SyncToken ?? null,
    created_at_qbo: md.CreateTime ? new Date(md.CreateTime) : null,
    updated_at_qbo: md.LastUpdatedTime ? new Date(md.LastUpdatedTime) : null,
  };
}

export function mapInvoice(inv: any) {
  const md = inv.MetaData || {};
  return {
    id: String(inv.Id),
    customer_ref: inv.CustomerRef?.value ?? null,
    txn_date: inv.TxnDate ? new Date(inv.TxnDate) : null,
    total_amt: Number(inv.TotalAmt ?? 0),
    balance: Number(inv.Balance ?? 0),
    doc_number: inv.DocNumber ?? null,
    status: inv.PrivateNote ? 'HasNote' : (inv.Balance > 0 ? 'Open' : 'Paid'),
    sync_token: inv.SyncToken ?? null,
    created_at_qbo: md.CreateTime ? new Date(md.CreateTime) : null,
    updated_at_qbo: md.LastUpdatedTime ? new Date(md.LastUpdatedTime) : null,
  };
}

export function mapInvoiceLines(inv: any) {
  const lines = Array.isArray(inv.Line) ? inv.Line : [];
  return lines
    .filter((l: any) => l.SalesItemLineDetail)
    .map((l: any, idx: number) => {
      const d = l.SalesItemLineDetail;
      return {
        line_no: idx + 1,
        item_ref: d.ItemRef?.value ?? null,
        description: l.Description ?? null,
        qty: d.Qty != null ? Number(d.Qty) : null,
        rate: d.UnitPrice != null ? Number(d.UnitPrice) : null,
        amount: l.Amount != null ? Number(l.Amount) : null,
      };
    });
}

