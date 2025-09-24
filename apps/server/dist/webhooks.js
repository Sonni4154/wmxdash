import { Router } from 'express';
import crypto from 'crypto';
import { Pool } from 'pg';
/**
 * Intuit sends a header `intuit-signature` which is base64(HMAC_SHA256(rawBody, WEBHOOK_VERIFIER_TOKEN))
 * We must verify against the **raw** request body.
 */
const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const WEBHOOK_TOKEN = process.env.QBO_WEBHOOK_VERIFIER_TOKEN || '';
if (!WEBHOOK_TOKEN) {
    // Not throwing at import-time; route will error out with a clear message if invoked.
    console.warn('[webhooks] QBO_WEBHOOK_VERIFIER_TOKEN not set');
}
/**
 * IMPORTANT: This route expects `express.raw({ type: 'application/json' })`
 * to be used ONLY for this path so we can compute the HMAC on the raw body.
 * See index.ts for how we mount the raw-body middleware on this path.
 */
// POST /api/webhooks/quickbooks
router.post('/api/webhooks/quickbooks', async (req, res) => {
    try {
        if (!WEBHOOK_TOKEN) {
            return res.status(500).json({ error: 'webhook_token_not_configured' });
        }
        const sigHeader = (req.headers['intuit-signature'] || '');
        if (!sigHeader) {
            return res.status(400).json({ error: 'missing_signature' });
        }
        // req.body is a Buffer because of express.raw()
        const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
        const hmac = crypto.createHmac('sha256', WEBHOOK_TOKEN).update(rawBody).digest('base64');
        if (hmac !== sigHeader) {
            console.error('[webhooks] signature mismatch');
            return res.status(401).json({ error: 'invalid_signature' });
        }
        // Store the event for async processing
        const payloadStr = rawBody.toString('utf8');
        await pool.query(`
      INSERT INTO webhook_events (qbo_event_id, entity_type, entity_id, operation, payload)
      VALUES (NULL, NULL, NULL, NULL, $1::jsonb)
      `, [payloadStr]);
        // Acknowledge quickly
        return res.status(200).json({ ok: true });
    }
    catch (e) {
        console.error('[webhooks/qbo] error:', e);
        return res.status(500).json({ error: 'internal_error' });
    }
});
export default router;
