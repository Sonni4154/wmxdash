# Harden QBO Integration and API (Dockerized, ESM-safe, Upserts, Admin Refresh)

## Summary
This PR hardens our QuickBooks Online integration and the API runtime so the backend can reliably:
- keep OAuth tokens fresh,
- read data from QuickBooks via SDK,
- normalize/insert that data into Postgres with conflict-safe upserts,
- expose clean endpoints for sync/monitoring,
- and run reproducibly in Docker with healthchecks + one-shot migrations.

## What changed
### Orchestration & Build
- **Dockerfile (multi-stage)** for `apps/server` to keep final image slim.
- **docker-compose** services:
  - `db` (Postgres 16) with healthcheck & volume.
  - `migrations` one-shot container to apply SQL on startup.
  - `api` for `apps/server`, healthchecked.
  - `refresher` worker that optionally triggers admin refresh on a cadence.
  - (kept) `tokenmgr` (qbo-token-manager) as internal, not exposed.
- Healthchecks + proper `depends_on` wiring.

### TypeScript / ESM Compatibility
- Project is ESM (`"type": "module"`). We:
  - added **explicit `.js` extensions** to local imports,
  - used `createRequire` shim to load CommonJS **`node-quickbooks`** safely.
- Fixed `tsconfig` so tests don’t break `rootDir` builds.

### API Endpoints
- **Admin refresh**: `POST /api/qbo/refresh` (header `x-admin-key` required).
- **Status**: `GET /api/qbo/status` returns token expiry & realm.
- **Company diag**: `GET /api/qbo/company` (SDK → fallback SQL).
- **Sync endpoints** (normalize SDK → arrays, then upsert):
  - `GET /api/qbo/sync/customers`
  - `GET /api/qbo/sync/items`
  - `GET /api/qbo/sync/invoices`
- **CDC alias**: `GET /api/qbo-cdc` → forwards to `/api/qbo/cdc`.
- Error responses now include `{ error, message, detail }` for fast triage.

### Database & Migrations
- Bootstrapped “official” integration schema:
  - `integrations(provider, org_id, updated_at)`
  - `qbo_tokens(integration_id, access_token, refresh_token, expires_at, realm_id, version, updated_at)`
  - `qbo_customers`, `qbo_items`, `qbo_invoices`, `qbo_invoice_lines`
- All upserts use `ON CONFLICT` and refresh `updated_at`.

### Testing
- **Vitest** smoke tests for server endpoints:
  - API liveness, minimal status, mocked CDC, and list endpoints.

---

## How to run (local Docker)
```bash
# 1) Put your local env values (do NOT commit real secrets)
cp infra/docker/.env.example infra/docker/.env
# edit .env values as needed

# 2) Build images
docker compose -f infra/docker/docker-compose.yml build

# 3) Start stack
docker compose -f infra/docker/docker-compose.yml up -d

# 4) Tail API logs
docker compose -f infra/docker/docker-compose.yml logs -f api
```

## Key environment variables
> Do **NOT** commit real secrets. Use `.env` locally; `.env.example` should document required keys.

- `DATABASE_URL=postgres://postgres:postgres@db:5432/app`
- `QBO_CLIENT_ID=...`
- `QBO_CLIENT_SECRET=...`
- `QBO_REALM_ID=...`
- `QBO_REFRESH_TOKEN_INIT=...` *(optional bootstrap if DB is empty)*
- `QBO_USE_SANDBOX=false|true`
- `ADMIN_API_KEY=...` *(required to call `/api/qbo/refresh`)*
- `REFRESH_INTERVAL_MS=2700000` *(worker cadence)*
- `REFRESH_THRESHOLD_S=900`
- `INTEGRATION_PROVIDER=quickbooks`
- `INTEGRATION_ORG_ID=<uuid for org>`

## Endpoints (admin & ops)
```text
GET  /                    -> health string
GET  /api/integrations    -> connection status
GET  /api/qbo/status      -> token status {expires_at, seconds_until_expiry, realm_id}
POST /api/qbo/refresh     -> refresh token (header: x-admin-key)
GET  /api/qbo/company     -> QBO company info (SDK → fallback SQL)
GET  /api/qbo/sync/customers
GET  /api/qbo/sync/items
GET  /api/qbo/sync/invoices
GET  /api/qbo-cdc         -> alias to /api/qbo/cdc
POST /api/webhooks/quickbooks (raw body) -> reserved for HMAC-verified webhooks
```

## DB Schema (high-level)
- `integrations`: `provider` + `org_id` unique; `updated_at` heartbeat
- `qbo_tokens`: latest token per integration; `version` increments on refresh
- Entities:
  - `qbo_customers(qbo_id, display_name, …, raw)`
  - `qbo_items(qbo_id, name, type, …, raw)`
  - `qbo_invoices(qbo_id, customer_ref, dates, totals, status, raw)`
  - `qbo_invoice_lines(invoice_qbo_id, line_num, item_ref, qty, rate, amount, raw)`

## Manual verification
```bash
# API alive
curl -s http://localhost:3000/ ; echo

# Token status
curl -s http://localhost:3000/api/qbo/status | jq

# Manual refresh (requires header)
source infra/docker/.env
curl -s -X POST http://localhost:3000/api/qbo/refresh -H "x-admin-key: ${ADMIN_API_KEY}" | jq

# Company diag
curl -s http://localhost:3000/api/qbo/company | jq

# Syncs (expect { ok: true, count: N, ... })
curl -s http://localhost:3000/api/qbo/sync/customers | jq
curl -s http://localhost:3000/api/qbo/sync/items | jq
curl -s http://localhost:3000/api/qbo/sync/invoices | jq
```

## Deployment notes
- Compose services use healthchecks so `api` and `refresher` wait for `db`.
- Ensure `.env` is provided at runtime (K/V in your orchestrator or mounted secret).
- Place a reverse proxy (nginx/caddy) with TLS in front of `api` for production.

## Risks / Tradeoffs
- `node-quickbooks` is CJS; we use `createRequire` under ESM which is stable but worth keeping an eye on if SDK changes.
- Admin refresh endpoint is powerful; it’s gated by `x-admin-key`, but avoid exposing it publicly.
- Webhooks route is mounted with raw body but verification logic is minimal for now (follow-up task).

## Follow-ups (tracked next)
- ✅ **Short-term**
  - Add DB indexes (`qbo_*` primary keys and foreign keys) for speed.
  - Add `qbo_cursors` table + CDC polling job to fetch only deltas.
  - Implement webhook HMAC verification + entity upsert in the handler.
  - Observability: pino logs, request IDs, `/metrics` via prom-client.
- 🎯 **Frontend MVP**
  - React + Vite app for Dashboard, QuickBooks (sync controls + tables), Activity.
  - Token card (expires in X), last sync time, revenue last 30d chart.
  - Admin button (optional) to trigger refresh (sends `x-admin-key`).
- 🔐 **Security**
  - Rate limit admin routes; enforce CORS strict origins.
  - Mask secrets in logs.
- 🚀 **CI/CD**
  - Lint/typecheck/test on PR, docker build, push image, small staging stack.

## Screenshots / Logs
_Add screenshots or curl output confirming: status, refresh ok, sync counts, and company info._

## Checklist
- [x] Builds & runs via `docker compose`
- [x] Token refresh & status endpoints behave
- [x] QBO reads return data
- [x] Upserts are idempotent (`ON CONFLICT`)
- [x] Tests pass: `pnpm -C apps/server test`
- [x] No secrets committed; `.env` stays local
