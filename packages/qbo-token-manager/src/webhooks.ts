import type { RequestHandler } from "express";
import { verifyWebhookSignature } from "./auth";
export function makeQboWebhookHandler(onEvent: (payload: any) => Promise<void>): RequestHandler {
  return async (req, res) => {
    const signature = req.header("intuit-signature") || "";
    const raw = (req as any).rawBody || JSON.stringify(req.body);
    if (!verifyWebhookSignature(raw, signature)) return res.status(401).send("invalid signature");
    await onEvent(JSON.parse(raw));
    res.status(200).send("ok");
  };
}
