// apps/web/lib/api.ts
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '/api').trim();

/** Build a query string from a plain object (skips null/undefined/empty). */
function toQuery(obj: Record<string, any> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    // allow arrays
    if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
    else p.append(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

/**
 * Options accepted by apiGet/apiPost.
 * - You can pass plain {limit, offset, q} (legacy) and it becomes query params.
 * - Or pass { query: {...}, headers, cache, ... } like RequestInit with extras.
 */
export type ApiOptions = RequestInit & {
  query?: Record<string, any>;
  // legacy convenience (so pages can call apiGet('/x', { limit: 10 }))
  limit?: number;
  offset?: number;
  q?: string;
};

function splitOptions(options?: ApiOptions): {
  init: RequestInit;
  query: Record<string, any>;
} {
  if (!options) return { init: {}, query: {} };

  // peel off known query-ish keys + "query"
  const { query: qObj, limit, offset, q, ...maybeInit } = options;
  const query: Record<string, any> = { ...(qObj || {}) };
  if (limit !== undefined) query.limit = limit;
  if (offset !== undefined) query.offset = offset;
  if (q !== undefined) query.q = q;

  return { init: maybeInit, query };
}

export async function apiGet<T>(path: string, options?: ApiOptions): Promise<T> {
  const { init, query } = splitOptions(options);
  const url = `${API_BASE}${path}${toQuery(query)}`;
  const res = await fetch(url, {
    ...init,
    method: 'GET',
    headers: { accept: 'application/json', ...(init.headers || {}) },
    cache: init.cache ?? 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GET ${path} failed: ${res.status} ${res.statusText} ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: any, options?: ApiOptions): Promise<T> {
  const { init, query } = splitOptions(options);
  const url = `${API_BASE}${path}${toQuery(query)}`;
  const res = await fetch(url, {
    ...init,
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(init.headers || {}),
    },
    cache: init.cache ?? 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST ${path} failed: ${res.status} ${res.statusText} ${text}`);
  }
  return res.json() as Promise<T>;
}

