"use strict";
/**
 * Import and re-export all Cloud Functions so that they can be deployed.
 * This file is the single source of truth for all deployed functions.
 * It is structured to export only the multi-tenant functions, enforcing the
 * architectural mandate for strict data isolation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpHealth = exports.scheduledDailyDigest = exports.onApplicationUpdate = exports.onApplicationCreate = exports.onJobWrite = void 0;
// Multi-Tenant Firestore Triggers
var on_write_1 = require("./triggers/orgs/jobs/on-write");
Object.defineProperty(exports, "onJobWrite", { enumerable: true, get: function () { return on_write_1.onJobWrite; } });
var on_create_1 = require("./triggers/orgs/applications/on-create");
Object.defineProperty(exports, "onApplicationCreate", { enumerable: true, get: function () { return on_create_1.onApplicationCreate; } });
var on_write_2 = require("./triggers/orgs/applications/on-write");
Object.defineProperty(exports, "onApplicationUpdate", { enumerable: true, get: function () { return on_write_2.onApplicationUpdate; } });
// Note: Callable functions for admin actions and resume uploads will be added here
// once they are rewritten for multi-tenancy.
// Scheduled Functions
var daily_digest_1 = require("./scheduled/daily-digest");
Object.defineProperty(exports, "scheduledDailyDigest", { enumerable: true, get: function () { return daily_digest_1.scheduledDailyDigest; } });
// HTTP Functions
var health_1 = require("./http/health");
Object.defineProperty(exports, "httpHealth", { enumerable: true, get: function () { return health_1.httpHealth; } });
//# sourceMappingURL=index.js.map