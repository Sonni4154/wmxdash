import { pgTable, uuid, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  orgId: uuid("org_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const qboTokens = pgTable("qbo_tokens", {
  integrationId: uuid("integration_id").primaryKey().references(() => integrations.id),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  realmId: text("realm_id").notNull(),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
