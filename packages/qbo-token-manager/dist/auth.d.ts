import type { DB } from "./types";
export declare function buildAuthorizeUrl(state: string): string;
export declare function handleCallback(db: DB, code: string, realmId: string, integrationId: string): Promise<void>;
export declare function getAccessToken(db: DB, integrationId: string): Promise<{
    token: any;
    realmId: any;
}>;
export declare function verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean;
