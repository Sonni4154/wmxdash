// apps/server/src/qboMap.ts
type AnyObj = Record<string, any>;

export function mapCustomer(c: AnyObj) {
  return {
    qbo_id: String(c.Id),
    display_name: c.DisplayName ?? '',
    given_name: c.GivenName ?? '',
    family_name: c.FamilyName ?? '',
    email: c.PrimaryEmailAddr?.Address ?? '',
    phone: c.PrimaryPhone?.FreeFormNumber ?? '',
    active: Boolean(c.Active ?? true),
    created_at_utc: c.MetaData?.CreateTime ? new Date(c.MetaData.CreateTime) : null,
    updated_at_utc: c.MetaData?.LastUpdatedTime ? new Date(c.MetaData.LastUpdatedTime) : null,
    raw: c, // keep raw JSON for diffs/debug
  };
}

export function mapItem(i: AnyObj) {
  return {
    qbo_id: String(i.Id),
    name: i.Name ?? '',
    active: Boolean(i.Active ?? true),
    type: i.Type ?? '',               // Inventory | Service | NonInventory | etc.
    sku: i.Sku ?? '',
    unit_price: i.UnitPrice ?? null,
    income_account_ref: i.IncomeAccountRef?.value ?? null,
    expense_account_ref: i.ExpenseAccountRef?.value ?? null,
    asset_account_ref: i.AssetAccountRef?.value ?? null,
    created_at_utc: i.MetaData?.CreateTime ? new Date(i.MetaData.CreateTime) : null,
    updated_at_utc: i.MetaData?.LastUpdatedTime ? new Date(i.MetaData.LastUpdatedTime) : null,
    raw: i,
  };
}

export function mapInvoice(inv: AnyObj) {
  return {
    qbo_id: String(inv.Id),
    doc_number: inv.DocNumber ?? null,
    txn_date: inv.TxnDate ? new Date(inv.TxnDate) : null,
    customer_ref: inv.CustomerRef?.value ?? null,
    total_amt: inv.TotalAmt ?? 0,
    balance: inv.Balance ?? 0,
    currency: inv.CurrencyRef?.value ?? null,
    created_at_utc: inv.MetaData?.CreateTime ? new Date(inv.MetaData.CreateTime) : null,
    updated_at_utc: inv.MetaData?.LastUpdatedTime ? new Date(inv.MetaData.LastUpdatedTime) : null,
    raw: inv,
  };
}

export function mapInvoiceLines(inv: AnyObj) {
  const invId = String(inv.Id);
  const lines = Array.isArray(inv.Line) ? inv.Line : [];
  return lines.map((ln: AnyObj, idx: number) => {
    const sid = ln.SalesItemLineDetail || {};
    return {
      invoice_qbo_id: invId,
      line_no: idx + 1,
      amount: ln.Amount ?? 0,
      detail_type: ln.DetailType ?? '',
      item_ref: sid.ItemRef?.value ?? null,
      qty: sid.Qty ?? null,
      unit_price: sid.UnitPrice ?? null,
      tax_code_ref: sid.TaxCodeRef?.value ?? null,
      raw: ln,
    };
  });
}

