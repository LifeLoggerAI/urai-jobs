"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
const v2_1 = require("firebase-functions/v2");
(0, v2_1.setGlobalOptions)({ maxInstances: 2 });
__exportStar(require("./triggers/onJobWrite"), exports);
__exportStar(require("./triggers/onApplicationCreate"), exports);
__exportStar(require("./api/admin"), exports);
__exportStar(require("./api/health"), exports);
__exportStar(require("./scheduled/dailyDigest"), exports);
