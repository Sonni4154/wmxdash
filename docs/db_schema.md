DB Schema (high-level)

integrations: provider + org_id unique; updated_at heartbeat

qbo_tokens: latest token per integration; version increments on refresh

Entities:

qbo_customers(qbo_id, display_name, …, raw)

qbo_items(qbo_id, name, type, …, raw)

qbo_invoices(qbo_id, customer_ref, dates, totals, status, raw)

qbo_invoice_lines(invoice_qbo_id, line_num, item_ref, qty, rate, amount, raw)
