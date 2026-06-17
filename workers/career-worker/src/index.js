"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_1 = require("./handlers/index");
const app = (0, express_1.default)();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';
app.use(express_1.default.json({ limit: '1mb' }));
app.get('/', (_req, res) => {
    res.status(200).send({ service: 'career-worker', ok: true });
});
app.get('/healthz', (_req, res) => {
    res.status(200).send({ service: 'career-worker', ok: true });
});
app.post('/execute-job', async (req, res) => {
    const result = await (0, index_1.handleJob)(req.body ?? {});
    res.status(200).send(result);
});
app.listen(port, host, () => {
    console.log(JSON.stringify({ event: 'worker.started', service: 'career-worker', host, port }));
});
