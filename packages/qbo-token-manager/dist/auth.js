"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAuthorizeUrl = buildAuthorizeUrl;
exports.handleCallback = handleCallback;
exports.getAccessToken = getAccessToken;
exports.verifyWebhookSignature = verifyWebhookSignature;
const node_crypto_1 = __importDefault(require("node:crypto"));
const date_fns_1 = require("date-fns");
const models_1 = require("./models");
const drizzle_orm_1 = require("drizzle-orm");
const QBO_AUTH_BASE = "https://appcenter.intuit.com/connect/oauth2";
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
function buildAuthorizeUrl(state) {
    const params = new URLSearchParams({
        client_id: process.env.QBO_CLIENT_ID,
        response_type: "code",
        scope: [
            "com.intuit.quickbooks.accounting",
            "openid", "profile", "email", "phone", "address"
        ].join(" "),
        redirect_uri: process.env.QBO_REDIRECT_URI,
        state
    });
    return `${QBO_AUTH_BASE}?${params.toString()}`;
}
async function exchangeCode(code) {
    const b64 = Buffer.from(`${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`).toString("base64");
    const res = await fetch(QBO_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${b64}` },
        body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: process.env.QBO_REDIRECT_URI })
    });
    if (!res.ok)
        throw new Error(`QBO exchange failed: ${await res.text()}`);
    return res.json();
}
async function refresh(refreshToken) {
    const b64 = Buffer.from(`${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`).toString("base64");
    const res = await fetch(QBO_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${b64}` },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken })
    });
    if (!res.ok)
        throw new Error(`QBO refresh failed: ${await res.text()}`);
    return res.json();
}
async function handleCallback(db, code, realmId, integrationId) {
    const tok = await exchangeCode(code);
    const expiresAt = (0, date_fns_1.addSeconds)(new Date(), tok.expires_in - 60);
    await db.insert(models_1.qboTokens).values({ integrationId, accessToken: tok.access_token, refreshToken: tok.refresh_token, expiresAt, realmId })
        .onConflictDoUpdate({ target: models_1.qboTokens.integrationId, set: { accessToken: tok.access_token, refreshToken: tok.refresh_token, expiresAt } });
}
async function getAccessToken(db, integrationId) {
    const [row] = await db.select().from(models_1.qboTokens).where((0, drizzle_orm_1.eq)(models_1.qboTokens.integrationId, integrationId));
    if (!row)
        throw new Error("QBO tokens not found");
    if ((0, date_fns_1.isBefore)(row.expiresAt, new Date())) {
        const upd = await refresh(row.refreshToken);
        const expiresAt = (0, date_fns_1.addSeconds)(new Date(), upd.expires_in - 60);
        await db.update(models_1.qboTokens).set({ accessToken: upd.access_token, refreshToken: upd.refresh_token, expiresAt }).where((0, drizzle_orm_1.eq)(models_1.qboTokens.integrationId, integrationId));
        return { token: upd.access_token, realmId: row.realmId };
    }
    return { token: row.accessToken, realmId: row.realmId };
}
function verifyWebhookSignature(rawBody, signatureHeader) {
    const key = process.env.QBO_WEBHOOK_VERIFIER_TOKEN;
    const hmac = node_crypto_1.default.createHmac("sha256", key).update(rawBody).digest("base64");
    return node_crypto_1.default.timingSafeEqual(Buffer.from(signatureHeader || ""), Buffer.from(hmac));
}
