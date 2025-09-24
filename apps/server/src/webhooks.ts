// apps/server/src/webhooks.ts
import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';

const router = Router();

// Intuit sends HMAC-SHA256 over the **raw** body using the verifier token.
// We mounted this router with express.raw({ type: '*/*' }) so req.body is a Buffer.
function verifyIntuitSignature(req: Request): boolean {
  const verifier = process.env.QBO_WEBHOOK_VERIFIER || '';
  const sigHeader = req.get('intuit-signature') || '';
  if (!verifier || !sigHeader) return false;

  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  const hmac = crypto.createHmac('sha256', verifier);
  hmac.update(raw);
  const digest = hmac.digest('base64');
  return crypto.timingSafeEqual(Buffer.from(sigHeader), Buffer.from(digest));
}

// POST /
router.post('/', (req: Request, res: Response) => {
  try {
    if (!verifyIntuitSignature(req)) {
      return res.status(401).json({ ok: false, error: 'invalid_signature' });
    }

    // Parse the JSON from the raw buffer after signature validation
    let payload: any = {};
    try {
      const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      return res.status(400).json({ ok: false, error: 'invalid_json' });
    }

    // Basic shape: payload.eventNotifications[0].dataChangeEvent.entities[]
    // Don’t do heavy work here; enqueue or fire-and-forget.
    // For now, just log a compact summary:
    const entities =
      payload?.eventNotifications?.flatMap((n: any) =>
        n?.dataChangeEvent?.entities ?? []
      ) ?? [];

    console.log('[webhook] received', entities.map((e: any) => ({
      name: e?.name, id: e?.id, op: e?.operation
    })));

    // TODO: enqueue/schedule sync based on entity types if you like

    return res.json({ ok: true, received: entities.length });
  } catch (err) {
    console.error('[webhook] error', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// Health ping (optional)
router.get('/healthz', (_req, res) => res.json({ ok: true }));

export default router;

