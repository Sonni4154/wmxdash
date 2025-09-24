"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qboFetch = qboFetch;
const auth_1 = require("./auth");
function baseUrl(realmId) {
    const domain = process.env.QBO_ENV === "production" ? "quickbooks.api.intuit.com" : "sandbox-quickbooks.api.intuit.com";
    return `https://${domain}/v3/company/${realmId}`;
}
async function qboFetch(db, integrationId, path, init) {
    const { token, realmId } = await (0, auth_1.getAccessToken)(db, integrationId);
    const res = await fetch(`${baseUrl(realmId)}${path}`, {
        ...init,
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) }
    });
    if (!res.ok)
        throw new Error(`QBO API ${path} failed: ${res.status} ${await res.text()}`);
    return res.json();
}
