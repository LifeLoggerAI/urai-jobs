"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.health = void 0;
const https_1 = require("firebase-functions/v2/https");
exports.health = (0, https_1.onRequest)((request, response) => {
    response.status(200).send({
        status: "ok",
        build: process.env.K_REVISION,
    });
});
