// apps/server/src/qboRoutes.ts
import type { Express, Request, Response, NextFunction } from 'express';
import { qboQuery, qboCDC } from './qboClient.js';

const normalizeCdc = (s: string) => {
  switch (s.trim().toLowerCase()) {
    case 'customers': case 'customer': return 'Customer';
    case 'items':     case 'item':     return 'Item';
    case 'vendors':   case 'vendor':   return 'Vendor';
    case 'invoices':  case 'invoice':  return 'Invoice';
    case 'accounts':  case 'account':  return 'Account';
    case 'payments':  case 'payment':  return 'Payment';
    case 'estimates': case 'estimate': return 'Estimate';
    case 'bills':     case 'bill':     return 'Bill';
    case 'purchases': case 'purchase': return 'Purchase';
    case 'journalentries': case 'journalentry': return 'JournalEntry';
    case 'timeactivities': case 'timeactivity': return 'TimeActivity';
    default: return s;
  }
};

export function mountQboRoutes(app: Express) {
  // CDC
  app.get('/api/qbo/cdc', async (req: Request, res: Response) => {
    try {
      const entities = String(req.query.entities ?? 'Customer,Item')
        .split(',')
        .map(normalizeCdc)
        .filter(Boolean);

      const since = String(req.query.since ?? new Date(Date.now() - 24 * 3600_000).toISOString());
      const data = await qboCDC(entities, since);
      return res.json(data);
    } catch (e: any) {
      console.error('[qbo/cdc] error:', e);
      const detail = e?.message ?? (typeof e === 'object' ? JSON.stringify(e) : String(e));
      return res.status(500).json({ error: 'internal_error', detail });
    }
  });

  // Generic list endpoint LAST, e.g. /api/qbo/customers?fetchAll=true&limit=100
  app.get('/api/qbo/:entity', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entity = String(req.params.entity || '').toLowerCase();
      if (!entity) return res.status(400).json({ error: 'missing_entity' });

      // Let the explicit routes handle these:
      if (entity === 'cdc')   return res.redirect(307, '/api/qbo/cdc' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''));
      if (entity === 'status') return next(); // fall through to /api/qbo/status defined in index.ts

      const opts: Record<string, any> = {};
      if (req.query.limit)   opts.limit = Number(req.query.limit);
      if (req.query.offset)  opts.offset = Number(req.query.offset);
      if (req.query.orderBy) opts.orderBy = String(req.query.orderBy);
      if (req.query.fetchAll === 'true') opts.fetchAll = true;

      const data = await qboQuery(entity, opts);
      return res.json(data);
    } catch (e: any) {
      console.error('[qbo/list] error:', e);
      const detail = e?.message ?? (typeof e === 'object' ? JSON.stringify(e) : String(e));
      return res.status(500).json({ error: 'internal_error', detail });
    }
  });
}

