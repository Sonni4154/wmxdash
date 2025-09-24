-- sql/2025-09-23_core_qbo_entities.sql

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  org_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, org_id)
);

CREATE TABLE IF NOT EXISTS qbo_tokens (
  id BIGSERIAL PRIMARY KEY,
  integration_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  realm_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qbo_tokens_integration_updated_idx
  ON qbo_tokens (integration_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS qbo_customers (
  qbo_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  given_name TEXT,
  family_name TEXT,
  email TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT TRUE,
  raw JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qbo_items (
  qbo_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  active BOOLEAN DEFAULT TRUE,
  income_account_ref TEXT,
  expense_account_ref TEXT,
  raw JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qbo_invoices (
  qbo_id TEXT PRIMARY KEY,
  customer_ref TEXT,
  txn_date DATE,
  due_date DATE,
  balance NUMERIC,
  total_amt NUMERIC,
  status TEXT,
  raw JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qbo_invoice_lines (
  invoice_qbo_id TEXT NOT NULL,
  line_num INT NOT NULL,
  item_ref TEXT,
  qty NUMERIC,
  rate NUMERIC,
  amount NUMERIC,
  raw JSONB NOT NULL,
  PRIMARY KEY (invoice_qbo_id, line_num)
);

