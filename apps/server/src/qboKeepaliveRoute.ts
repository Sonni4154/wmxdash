// apps/server/src/qboKeepaliveRoute.ts
import { Router } from 'express';
import { refreshAccessTokenIfNeeded } from './qboToken.js';
const r = Router();

r.post('/qbo/keepalive', async (_req, res) => {
  await refreshAccessTokenIfNeeded(1800); // if <30m, refresh
  res.json({ ok: true });
});

export default r;

