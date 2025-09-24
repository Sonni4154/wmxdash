"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qboTokens = exports.integrations = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.integrations = (0, pg_core_1.pgTable)("integrations", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    provider: (0, pg_core_1.text)("provider").notNull(),
    orgId: (0, pg_core_1.uuid)("org_id").notNull(),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    lastSyncAt: (0, pg_core_1.timestamp)("last_sync_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow()
});
exports.qboTokens = (0, pg_core_1.pgTable)("qbo_tokens", {
    integrationId: (0, pg_core_1.uuid)("integration_id").primaryKey().references(() => exports.integrations.id),
    accessToken: (0, pg_core_1.text)("access_token").notNull(),
    refreshToken: (0, pg_core_1.text)("refresh_token").notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    realmId: (0, pg_core_1.text)("realm_id").notNull(),
    version: (0, pg_core_1.integer)("version").notNull().default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow()
});
