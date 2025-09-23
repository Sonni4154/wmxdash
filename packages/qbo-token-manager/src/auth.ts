import crypto from "node:crypto";
import { addSeconds, isBefore } from "date-fns";
import { qboTokens } from "./models";
import type { DB } from "./types";
import { eq } from "drizzle-orm";

const QBO_AUTH_BASE = "https://appcenter.intuit.com/connect/oauth2";
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

export function buildAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.QBO_CLIENT_ID!,
    response_type: "code",
    scope: [
      "com.intuit.quickbooks.accounting",
      "openid","profile","email","phone","address"
    ].join(" "),
    redirect_uri: process.env.QBO_REDIRECT_URI!,
    state
  });
  return `${QBO_AUTH_BASE}?${params.toString()}`;
}

async function exchangeCode(code: string) {
  const b64 = Buffer.from(`${process.env.QBO_CLIENT_ID!}:${process.env.QBO_CLIENT_SECRET!}`).toString("base64");
  const res = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${b64}` },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: process.env.QBO_REDIRECT_URI! })
  });
  if (!res.ok) throw new Error(`QBO exchange failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number; x_refresh_token_expires_in: number }>;
}

async function refresh(refreshToken: string) {
  const b64 = Buffer.from(`${process.env.QBO_CLIENT_ID!}:${process.env.QBO_CLIENT_SECRET!}`).toString("base64");
  const res = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${b64}` },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken })
  });
  if (!res.ok) throw new Error(`QBO refresh failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

export async function handleCallback(db: DB, code: string, realmId: string, integrationId: string) {
  const tok = await exchangeCode(code);
  const expiresAt = addSeconds(new Date(), tok.expires_in - 60);
  await db.insert(qboTokens).values({ integrationId, accessToken: tok.access_token, refreshToken: tok.refresh_token, expiresAt, realmId })
    .onConflictDoUpdate({ target: qboTokens.integrationId, set: { accessToken: tok.access_token, refreshToken: tok.refresh_token, expiresAt } });
}

export async function getAccessToken(db: DB, integrationId: string) {
  const [row] = await db.select().from(qboTokens).where(eq(qboTokens.integrationId, integrationId));
  if (!row) throw new Error("QBO tokens not found");
  if (isBefore(row.expiresAt, new Date())) {
    const upd = await refresh(row.refreshToken);
    const expiresAt = addSeconds(new Date(), upd.expires_in - 60);
    await db.update(qboTokens).set({ accessToken: upd.access_token, refreshToken: upd.refresh_token, expiresAt }).where(eq(qboTokens.integrationId, integrationId));
    return { token: upd.access_token, realmId: row.realmId };
  }
  return { token: row.accessToken, realmId: row.realmId };
}

export function verifyWebhookSignature(rawBody: string, signatureHeader: string) {
  const key = process.env.QBO_WEBHOOK_VERIFIER_TOKEN!;
  const hmac = crypto.createHmac("sha256", key).update(rawBody).digest("base64");
  return crypto.timingSafeEqual(Buffer.from(signatureHeader || ""), Buffer.from(hmac));
}
