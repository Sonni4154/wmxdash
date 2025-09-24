"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeQboWebhookHandler = makeQboWebhookHandler;
const auth_1 = require("./auth");
function makeQboWebhookHandler(onEvent) {
    return async (req, res) => {
        const signature = req.header("intuit-signature") || "";
        const raw = req.rawBody || JSON.stringify(req.body);
        if (!(0, auth_1.verifyWebhookSignature)(raw, signature))
            return res.status(401).send("invalid signature");
        await onEvent(JSON.parse(raw));
        res.status(200).send("ok");
    };
}
