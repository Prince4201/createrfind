// Vercel serverless entry point.
// Vercel calls this file as a Node.js function for every request.
// We initialise the Express app once (cached across warm invocations)
// and export it as the default handler.

import { getApp } from '../src/app.js';

let _handler = null;

export default async function handler(req, res) {
    if (!_handler) {
        const app = await getApp();
        _handler = app;
    }
    return _handler(req, res);
}
