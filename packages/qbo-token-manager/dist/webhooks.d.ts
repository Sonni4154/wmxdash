import type { RequestHandler } from "express";
export declare function makeQboWebhookHandler(onEvent: (payload: any) => Promise<void>): RequestHandler;
