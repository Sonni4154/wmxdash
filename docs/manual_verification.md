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

