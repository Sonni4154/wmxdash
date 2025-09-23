# WMX Employee Dashboard

Monorepo for the employee dashboard and QuickBooks token services.

## Stack
- **Web**: Next.js 14 (apps/web) — port 5173
- **API**: Express + pg (apps/server) — port 3000
- **Refresher**: background job (apps/refresher)
- **Token Manager**: DB schema + helpers (packages/qbo-token-manager)
- **DB**: Postgres 16 (docker service `db`)

## Quick start
```bash
cd infra/docker
cp .env.example .env   # set values
docker compose up -d

## Health

Web: http://localhost:5173/ → 200 OK

API: http://localhost:3000/ → 200 OK

#Environment

Configure infra/docker/.env. Important keys:
- `DATABASE_URL`
- INTEGRATION_PROVIDER=quickbooks
- QBO_REALM_ID=<realm>
- QBO_CLIENT_ID, QBO_CLIENT_SECRET
- QBO_REFRESH_TOKEN_INIT (optional seed)
- ADMIN_API_KEY (protects POST /api/qbo/refresh)

#Token endpoints (manual ops)

GET /api/qbo/status
POST /api/qbo/refresh (header x-admin-key: ...)

#Backup/Restore

Run infra/scripts/backup_wmx.sh → creates /opt/backups/wmx_bundle_<ts>.tgz.
Restore: unpack, restore DB (pg_dump or pgdata archive), docker compose up -d.

# API (apps/server)

Express API for employees and QBO token operations.

## Endpoints
- `GET /` — health
- `GET /api/employees` — demo list
- `GET /api/qbo/status` — current token state
- `POST /api/qbo/refresh` — force-refresh via Intuit (requires `x-admin-key`)

## Env
Reads from `infra/docker/.env`:
- `DATABASE_URL`
- `INTEGRATION_PROVIDER`, `QBO_REALM_ID`
- `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REFRESH_TOKEN_INIT`
- `ADMIN_API_KEY` (optional guard)

## Dev
```bash
pnpm -C apps/server dev```

# Refresher (apps/refresher)

Background process that updates the QBO token periodically.

## Current mode
- **Legacy table**: `qbo_tokens(id, token, updated_at)`. This keeps the stack green.

## Planned mode (official schema)
- Use `integrations` + `qbo_tokens(integration_id, access_token, refresh_token, expires_at, realm_id)`.
- The server exposes `POST /api/qbo/refresh` to force a refresh now.

## Ops
- Logs: `docker compose logs -f refresher`
- Recreate: `docker compose up -d --force-recreate refresher`

# Token Manager (packages/qbo-token-manager)

Holds the DB schema and helpers for QuickBooks tokens.

## Schema (official)
- `integrations(id uuid pk, provider text, org_id text, ...)`
- `qbo_tokens(integration_id uuid fk, access_token text, refresh_token text, expires_at timestamptz, realm_id text, version int, ...)`

## Migration
- File: `migrations/2025-09-17_qbo_init.sql`
- Apply manually: copy into DB container and `psql -f` (see root README)

