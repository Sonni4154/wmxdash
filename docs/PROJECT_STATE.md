# Project State (as of <9/20/25>))

## What’s working
- Postgres 16 healthy; compose stable.
- Web (Next.js) healthy on 5173.
- API up on 3000; healthcheck OK.
- Refresher running (legacy table mode), confirms writes.

## What’s new
- Manual QBO endpoints:
  - GET /api/qbo/status
  - POST /api/qbo/refresh (admin-guarded)
- Backup script: `infra/scripts/backup_wmx.sh`

## Next goals
- Migrate refresher to official schema (access/refresh/expiry).
- Replace legacy write path in refresher with official one.
- Lock down admin endpoints behind auth proxy / VPN.

