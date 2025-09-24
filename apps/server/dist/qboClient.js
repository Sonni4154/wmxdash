import { getQbo } from './qbo.js';
function asPromise(fn, ...args) {
    return new Promise((resolve, reject) => {
        fn.call(null, ...args, (e, res) => (e ? reject(e) : resolve(res)));
    });
}
function buildQboSql(entity, opts = {}) {
    const limit = Number.isFinite(opts.limit) ? Math.max(1, Number(opts.limit)) : 100;
    const offset = Number.isFinite(opts.offset) ? Math.max(0, Number(opts.offset)) : 0;
    const startPos = offset + 1;
    const orderBy = opts.orderBy ? ` ORDER BY ${opts.orderBy}` : '';
    return `SELECT * FROM ${entity} ${orderBy} STARTPOSITION ${startPos} MAXRESULTS ${limit}`;
}
export async function qboQuery(entityRaw, opts = {}) {
    const entity = String(entityRaw || '').trim().toLowerCase();
    const { qbo } = await getQbo();
    const useFindApi = (method, args = {}) => asPromise(qbo[method].bind(qbo), args);
    switch (entity) {
        case 'customer':
        case 'customers':
            return opts.fetchAll
                ? useFindApi('findCustomers', { fetchAll: true })
                : asPromise(qbo.findCustomers.bind(qbo), { limit: opts.limit, offset: opts.offset });
        case 'item':
        case 'items':
            return opts.fetchAll
                ? useFindApi('findItems', { fetchAll: true })
                : asPromise(qbo.findItems.bind(qbo), { limit: opts.limit, offset: opts.offset });
        case 'invoice':
        case 'invoices':
            return opts.fetchAll
                ? useFindApi('findInvoices', { fetchAll: true })
                : asPromise(qbo.findInvoices.bind(qbo), { limit: opts.limit, offset: opts.offset });
        case 'vendor':
        case 'vendors':
            return opts.fetchAll
                ? useFindApi('findVendors', { fetchAll: true })
                : asPromise(qbo.findVendors.bind(qbo), { limit: opts.limit, offset: opts.offset });
        case 'account':
        case 'accounts':
            return opts.fetchAll
                ? useFindApi('findAccounts', { fetchAll: true })
                : asPromise(qbo.findAccounts.bind(qbo), { limit: opts.limit, offset: opts.offset });
        case 'estimate':
        case 'estimates': {
            if (typeof qbo.findEstimates === 'function') {
                return opts.fetchAll
                    ? useFindApi('findEstimates', { fetchAll: true })
                    : asPromise(qbo.findEstimates.bind(qbo), { limit: opts.limit, offset: opts.offset });
            }
            const sql = buildQboSql('Estimate', opts);
            return asPromise(qbo.query.bind(qbo), sql);
        }
        case 'payment':
        case 'payments': {
            const sql = buildQboSql('Payment', opts);
            return asPromise(qbo.query.bind(qbo), sql);
        }
        case 'bill':
        case 'bills': {
            const sql = buildQboSql('Bill', opts);
            return asPromise(qbo.query.bind(qbo), sql);
        }
        case 'purchase':
        case 'purchases': {
            const sql = buildQboSql('Purchase', opts);
            return asPromise(qbo.query.bind(qbo), sql);
        }
        case 'journalentry':
        case 'journalentries': {
            const sql = buildQboSql('JournalEntry', opts);
            return asPromise(qbo.query.bind(qbo), sql);
        }
        case 'timeactivity':
        case 'timeactivities': {
            const sql = buildQboSql('TimeActivity', opts);
            return asPromise(qbo.query.bind(qbo), sql);
        }
        default: {
            const sqlEntity = entity.charAt(0).toUpperCase() + entity.slice(1);
            const sql = buildQboSql(sqlEntity, opts);
            return asPromise(qbo.query.bind(qbo), sql);
        }
    }
}
export async function qboCDC(entities, sinceISO) {
    const { qbo } = await getQbo();
    const out = {};
    const since = new Date(sinceISO).toISOString();
    for (const e of entities) {
        const entity = e === 'JournalEntries' ? 'JournalEntry' : e === 'TimeActivities' ? 'TimeActivity' : e;
        const sql = `SELECT * FROM ${entity} WHERE MetaData.LastUpdatedTime > '${since}' ORDER BY MetaData.LastUpdatedTime`;
        try {
            const rows = await asPromise(qbo.query.bind(qbo), sql);
            out[entity] = rows || [];
        }
        catch {
            out[entity] = [];
        }
    }
    return out;
}
