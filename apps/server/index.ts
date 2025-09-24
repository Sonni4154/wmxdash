// apps/server/src/index.ts
import express, { type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import { raw as rawBody } from "express";

import dbRoutes from "./dbRoutes.js";
import timeRoutes from "./timeRoutes.js";
import oauthRouter from "./oauth.js";
import webhookRouter from "./webhooks.js";
import { mountQboRoutes } from "./qboRoutes.js";

const app = express();

// Trust proxy (useful if behind nginx)
app.set("trust proxy", 1);

// --- Health (simple top-level)
app.get("/healthz", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// --- Webhooks MUST receive RAW body BEFORE json parser
// Intuit webhook verification signs the *raw* JSON payload.
// Do not put express.json() ahead of this for this path.
app.use("/api/qbo/webhooks", rawBody({ type: "application/json" }));
app.use("/api/qbo/webhooks", webhookRouter);

// --- Global parsers for everything else
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// --- Feature routers
// Database & query endpoints
app.use("/api/db", dbRoutes);

// Timeclock endpoints
app.use("/api/time", timeRoutes);

// OAuth (connect/callback) for QuickBooks
app.use(oauthRouter);

// QBO utility/status/sync endpoints (/api/qbo/*)
// (status, secure refresh, manual sync helpers, etc.)
mountQboRoutes(app);

// --- Fallback 404 for unknown API routes
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ ok: false, error: "not_found" });
});

// --- Boot
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});

