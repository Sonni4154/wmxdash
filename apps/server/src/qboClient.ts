import { getQbo } from './qbo.js';

type QueryOpts = {
  fetchAll?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: string;
};

function asPromise<T>(fn: Function, ...args: any[]): Promise<T> {
  return new Promise((resolve, reject) => {
    fn.call(null, ...args, (e: any, res: T) => (e ? reject(e) : resolve(res)));
  });
}

function buildQboSql(entity: string, opts: QueryOpts = {}): string {
  const limit = Number.isFinite(opts.limit) ? Math.max(1, Number(opts.limit)) : 100;
  const offset = Number.isFinite(opts.offset) ? Math.max(0, Number(opts.offset)) : 0;
  const startPos = offset + 1;
  const orderBy = opts.orderBy ? ` ORDER BY ${opts.orderBy}` : '';
  return `SELECT * FROM ${entity} ${orderBy} STARTPOSITION ${startPos} MAXRESULTS ${limit}`;
}

export async function qboQuery(entityRaw: string, opts: QueryOpts = {}) {
  const entity = String(entityRaw || '').trim().toLowerCase();
  const { qbo } = await getQbo();

  const useFindApi = (method: string, args: any = {}) =>
    asPromise<any[]>((qbo as any)[method].bind(qbo), args);

  switch (entity) {
    case 'customer':
    case 'customers':
      return opts.fetchAll
        ? useFindApi('findCustomers', { fetchAll: true })
        : asPromise<any[]>((qbo as any).findCustomers.bind(qbo), { limit: opts.limit, offset: opts.offset });

    case 'item':
    case 'items':
      return opts.fetchAll
        ? useFindApi('findItems', { fetchAll: true })
        : asPromise<any[]>((qbo as any).findItems.bind(qbo), { limit: opts.limit, offset: opts.offset });

    case 'invoice':
    case 'invoices':
      return opts.fetchAll
        ? useFindApi('findInvoices', { fetchAll: true })
        : asPromise<any[]>((qbo as any).findInvoices.bind(qbo), { limit: opts.limit, offset: opts.offset });

    case 'vendor':
    case 'vendors':
      return opts.fetchAll
        ? useFindApi('findVendors', { fetchAll: true })
        : asPromise<any[]>((qbo as any).findVendors.bind(qbo), { limit: opts.limit, offset: opts.offset });

    case 'account':
    case 'accounts':
      return opts.fetchAll
        ? useFindApi('findAccounts', { fetchAll: true })
        : asPromise<any[]>((qbo as any).findAccounts.bind(qbo), { limit: opts.limit, offset: opts.offset });

    case 'estimate':
    case 'estimates': {
      if (typeof (qbo as any).findEstimates === 'function') {
        return opts.fetchAll
          ? useFindApi('findEstimates', { fetchAll: true })
          : asPromise<any[]>((qbo as any).findEstimates.bind(qbo), { limit: opts.limit, offset: opts.offset });
      }
      const sql = buildQboSql('Estimate', opts);
      return asPromise<any[]>((qbo as any).query.bind(qbo), sql);
    }

    case 'payment':
    case 'payments': {
      const sql = buildQboSql('Payment', opts);
      return asPromise<any[]>((qbo as any).query.bind(qbo), sql);
    }

    case 'bill':
    case 'bills': {
      const sql = buildQboSql('Bill', opts);
      return asPromise<any[]>((qbo as any).query.bind(qbo), sql);
    }

    case 'purchase':
    case 'purchases': {
      const sql = buildQboSql('Purchase', opts);
      return asPromise<any[]>((qbo as any).query.bind(qbo), sql);
    }

    case 'journalentry':
    case 'journalentries': {
      const sql = buildQboSql('JournalEntry', opts);
      return asPromise<any[]>((qbo as any).query.bind(qbo), sql);
    }

    case 'timeactivity':
    case 'timeactivities': {
      const sql = buildQboSql('TimeActivity', opts);
      return asPromise<any[]>((qbo as any).query.bind(qbo), sql);
    }

    default: {
      const sqlEntity = entity.charAt(0).toUpperCase() + entity.slice(1);
      const sql = buildQboSql(sqlEntity, opts);
      return asPromise<any[]>((qbo as any).query.bind(qbo), sql);
    }
  }
}

export async function qboCDC(entities: string[], sinceISO: string) {
  const { qbo } = await getQbo();
  const out: Record<string, any[]> = {};
  const since = new Date(sinceISO).toISOString();

  for (const e of entities) {
    const entity = e === 'JournalEntries' ? 'JournalEntry' : e === 'TimeActivities' ? 'TimeActivity' : e;
    const sql = `SELECT * FROM ${entity} WHERE MetaData.LastUpdatedTime > '${since}' ORDER BY MetaData.LastUpdatedTime`;
    try {
      const rows = await asPromise<any[]>((qbo as any).query.bind(qbo), sql);
      out[entity] = rows || [];
    } catch {
      out[entity] = [];
    }
  }
  return out;
}

