import type { DB } from "./types";
import { getAccessToken } from "./auth";

function baseUrl(realmId: string) {
  const domain = process.env.QBO_ENV === "production" ? "quickbooks.api.intuit.com" : "sandbox-quickbooks.api.intuit.com";
  return `https://${domain}/v3/company/${realmId}`;
}
export async function qboFetch(db: DB, integrationId: string, path: string, init?: RequestInit) {
  const { token, realmId } = await getAccessToken(db, integrationId);
  const res = await fetch(`${baseUrl(realmId)}${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) }
  });
  if (!res.ok) throw new Error(`QBO API ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}
