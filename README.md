# WMX Dashboard (Marin Pest Control)

Production-ready backend for syncing QuickBooks Online (QBO) data into Postgres and exposing it to the WMX Dashboard. Built with **Node 20 + TypeScript (ESM)**, **pnpm**, **Docker Compose**, and **Postgres 16**.

> TL;DR: `docker compose -f infra/docker/docker-compose.yml up -d` then hit `http://localhost:3000/`.

---

## Table of contents

- [What’s in here](#whats-in-here)
- [Architecture](#architecture)
- [Quick start (Docker)](#quick-start-docker)
- [Environment](#environment)
- [Endpoints](#endpoints)
- [Database schema](#database-schema)
- [Development (no Docker)](#development-no-docker)
- [Testing](#testing)
- [Migrations](#migrations)
- [Admin & Ops](#admin--ops)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Frontend plan](#frontend-plan)
- [Security notes](#security-notes)
- [License](#license)

---

## What’s in here

- **apps/server** – Express API (ESM). Reads tokens from DB, talks to Intuit via `node-quickbooks`, upserts data into Postgres.
- **packages/qbo-token-manager** – Internal helper to exchange/refresh tokens (not exposed publicly).
- **apps/refresher** – Worker that pings the API admin refresh route on an interval (keeps tokens healthy).
- **infra/docker** – `docker-compose.yml` and Dockerfile for multi-stage builds and one-shot migrations.
- **sql** – Schema bootstrap and entity tables for Customers, Items, Invoices (+ lines).
- **docs** – PR body and reference docs.

---

## Architecture

```
[QuickBooks Online]
        ▲
        │ OAuth2 + REST (node-quickbooks)
        ▼
  [API: apps/server]  ←───────  [Refresher: apps/refresher]
        │  ▲                         (calls /api/qbo/refresh securely)
        │  │
        ▼  │
   Postgres 16 (db)
        │
   upserted entities
```

- **Tokens** live in `qbo_tokens`; API retrieves them to create a QBO SDK client.
- **Sync** endpoints fetch from QBO → normalize → **UPSERT** into Postgres (idempotent).
- **Docker** healthchecks and dependency ordering (DB → API → refresher).
- **ESM & CJS compat**: We load `node-quickbooks` via `createRequire` to keep the server ESM-native.

---

## Quick start (Docker)

1) Copy the example env and fill in values (do **not** commit real secrets):
```bash
cp infra/docker/.env.example infra/docker/.env
nano infra/docker/.env
```

2) Build and start:
```bash
docker compose -f infra/docker/docker-compose.yml build
docker compose -f infra/docker/docker-compose.yml up -d
docker compose -f infra/docker/docker-compose.yml logs -f api
```

3) Hit the API:
```bash
curl -s http://localhost:3000/ ; echo
# API is running
```

---

## Environment

The server reads configuration from `infra/docker/.env` in Docker, or your shell in dev.

**Required (no secrets in git):**

- `DATABASE_URL=postgres://postgres:postgres@db:5432/app`
- `QBO_CLIENT_ID=...`
- `QBO_CLIENT_SECRET=...`
- `QBO_REALM_ID=...`
- `QBO_USE_SANDBOX=false|true`
- `INTEGRATION_PROVIDER=quickbooks`
- `INTEGRATION_ORG_ID=<uuid>`
- `ADMIN_API_KEY=<random-hex>` *(to call admin routes)*

**Optional / recommended:**

- `QBO_REFRESH_TOKEN_INIT=...` *(bootstrap only if DB empty)*
- `REFRESH_INTERVAL_MS=2700000` *(45m refresher cadence)*
- `REFRESH_THRESHOLD_S=900` *(refresh when <15m left)*
- `CORS_ORIGIN=http://localhost:5173` *(future webapp)*
- `QBO_WEBHOOK`, `QBO_WEBHOOK_VERIFIER_TOKEN` *(reserved for webhooks)*

> **Never commit `.env`.** `.env.example` documents required keys.

---

## Endpoints

Public health:
```
GET  /                   → "API is running"
GET  /api/integrations   → [{ provider, status, org_id, updated_at }]
```

QBO status / control:
```
GET  /api/qbo/status     → { hasToken, expires_at, seconds_until_expiry, realm_id, updated_at }
POST /api/qbo/refresh    → { ok, provider, org_id, expires_at, realm_id }   (header: x-admin-key)

GET  /api/qbo/company    → CompanyInfo via SDK (fallback to SQL select)
GET  /api/qbo/sync/customers  → { ok, count }
GET  /api/qbo/sync/items      → { ok, count }
GET  /api/qbo/sync/invoices   → { ok, count }
GET  /api/qbo/cdc             → reserved (CDC handler)
GET  /api/qbo-cdc             → alias to /api/qbo/cdc

POST /api/webhooks/quickbooks → reserved (verify + upsert)
```

**Admin header** for privileged calls:
```
x-admin-key: ${ADMIN_API_KEY}
```

**Handy cURL**
```bash
# status
curl -s http://localhost:3000/api/qbo/status | jq

# admin refresh
source infra/docker/.env
curl -s -X POST http://localhost:3000/api/qbo/refresh -H "x-admin-key: ${ADMIN_API_KEY}" | jq

# company info
curl -s http://localhost:3000/api/qbo/company | jq

# syncs
curl -s http://localhost:3000/api/qbo/sync/customers | jq
curl -s http://localhost:3000/api/qbo/sync/items | jq
curl -s http://localhost:3000/api/qbo/sync/invoices | jq
```

---

## Database schema

High-level tables (full SQL in `/sql`):

- `integrations(provider, org_id, updated_at)` with unique `(provider, org_id)`.
- `qbo_tokens(integration_id, access_token, refresh_token, expires_at, realm_id, version, updated_at)`.
- `qbo_customers(qbo_id PK, …, raw JSONB)`.
- `qbo_items(qbo_id PK, …, raw JSONB)`.
- `qbo_invoices(qbo_id PK, customer_ref, txn_date, …, raw JSONB)`.
- `qbo_invoice_lines(invoice_qbo_id FK, line_num, item_ref, qty, rate, amount, raw JSONB)`.

All entity upserts use `ON CONFLICT` and bump `updated_at`.

**Indexes to add soon (perf):**
- `qbo_customers(qbo_id)`, `qbo_items(qbo_id)`, `qbo_invoices(qbo_id)`, `qbo_invoice_lines(invoice_qbo_id)`.
- Date/active partial indexes as needed.

---

## Development (no Docker)

Requirements: Node 20+, pnpm 10+

```bash
pnpm -v      # should be 10.x (corepack handles it in Docker; locally run `corepack enable`)
pnpm i
pnpm -C apps/server build
pnpm -C apps/server start  # assumes a local DATABASE_URL + QBO env in your shell
```

---

## Testing

```bash
pnpm -C apps/server test
```

Tests are **smoke tests** covering:
- API liveness
- minimal status
- mocked CDC
- list endpoints

---

## Migrations

In Docker, a **migrations** one-shot container compiles server and applies SQL in `/sql` on up.

If you need to re-run locally:
```bash
docker compose -f infra/docker/docker-compose.yml rm -f migrations
docker compose -f infra/docker/docker-compose.yml up -d migrations
docker compose -f infra/docker/docker-compose.yml logs -f migrations
```

---

## Admin & Ops

- **Token lifecycle**: `/api/qbo/status` reports remaining lifetime; `/api/qbo/refresh` extends it.
- **Refresher worker**: calls admin refresh (internal) on cadence; configure via `REFRESH_INTERVAL_MS`, `REFRESH_THRESHOLD_S`.
- **Healthchecks**: compose waits for Postgres, API marks healthy once serving `/`.

**Zip a clean source bundle** (no bloat):
```bash
cd /opt/wmx
git archive --format=zip --output ../wmx-source-$(date +%Y%m%d).zip HEAD
```

---

## Troubleshooting

- **`unauthorized` on refresh** → Missing/incorrect `x-admin-key`. Source your `.env` or set the header manually.
- **`no_token_in_db`** → Insert a bootstrap refresh token (`QBO_REFRESH_TOKEN_INIT`) or run token manager to seed.
- **Company info error** → Some QBO tenants require minor version; switch constructor minor from `null` → `'70'`.
- **ESM/CJS error (`require is not defined`)** → Ensure we use `createRequire(import.meta.url)` for `node-quickbooks` (already done).

Check logs:
```bash
docker compose -f infra/docker/docker-compose.yml logs -f api
```

---

## Roadmap

- **CDC ingestion** with `qbo_cursors` table (fetch deltas since last cursor).
- **Webhook verification** (HMAC) + entity upsert pipeline.
- **Observability**: pino logs, request IDs, `/metrics` (prom-client).
- **Indexes & perf** for large lists and analytics queries.
- **CI/CD**: lint, typecheck, tests, docker build on PR; staging stack.

---

## Frontend plan

- **Stack**: React + Vite + TypeScript, Tailwind + shadcn/ui, TanStack Query.
- **Pages**:
  1. **Dashboard** – Token card (expires in X), last sync time, counts, revenue last 30d chart.
  2. **QuickBooks** – Buttons to run syncs; tables for Customers/Items/Invoices (from DB).
  3. **Activity** – Recent sync runs / errors (from a `sync_runs` table later).
- **API base**: `VITE_API_URL` → this server. Optional admin action wired with `x-admin-key` (internal only).
- **Deploy** behind the API reverse proxy with TLS.

---

## Security notes

- Keep admin routes private; they’re gated by `x-admin-key` but should not be public-facing.
- Lock CORS to exact origins (`CORS_ORIGIN`).
- Do not log secrets. Mask tokens in any debug output.
- Never commit `.env`. Use `.env.example` to document required keys.

---

## License

Internal project for Marin Pest Control (House of Reiser). All rights reserved.
