const BASE =
  (import.meta as any).env?.VITE_API_URL ??
  (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_API_URL) ??
  '/api';

export async function apiGET<T>(path: string, params?: Record<string, any>) {
  const url = new URL(path, BASE);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

