-- Customers
CREATE TABLE IF NOT EXISTS qbo_customers (
  id           bigserial PRIMARY KEY,
  qbo_id       text UNIQUE NOT NULL,
  display_name text NOT NULL,
  given_name   text,
  family_name  text,
  email        text,
  phone        text,
  active       boolean,
  raw          jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Items (Products/Services)
CREATE TABLE IF NOT EXISTS qbo_items (
  id                 bigserial PRIMARY KEY,
  qbo_id             text UNIQUE NOT NULL,
  name               text NOT NULL,
  type               text,
  active             boolean,
  income_account_ref text,
  expense_account_ref text,
  raw                jsonb NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Invoices (header)
CREATE TABLE IF NOT EXISTS qbo_invoices (
  id            bigserial PRIMARY KEY,
  qbo_id        text UNIQUE NOT NULL,
  customer_ref  text,
  txn_date      date,
  due_date      date,
  balance       numeric(14,2),
  total_amt     numeric(14,2),
  status        text,
  raw           jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Invoice lines (detail)
CREATE TABLE IF NOT EXISTS qbo_invoice_lines (
  id             bigserial PRIMARY KEY,
  invoice_qbo_id text NOT NULL,
  line_num       integer,
  item_ref       text,
  qty            numeric(14,4),
  rate           numeric(14,4),
  amount         numeric(14,2),
  raw            jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS qbo_invoice_lines_inv_idx ON qbo_invoice_lines (invoice_qbo_id);

