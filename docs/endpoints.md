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

