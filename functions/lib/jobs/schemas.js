"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobSchema = exports.notifyJobSchema = exports.analyzeJobSchema = exports.clipJobSchema = exports.renderJobSchema = void 0;
const zod_1 = require("zod");
exports.renderJobSchema = zod_1.z.object({
    type: zod_1.z.literal('render'),
    videoId: zod_1.z.string(),
});
exports.clipJobSchema = zod_1.z.object({
    type: zod_1.z.literal('clip'),
    videoId: zod_1.z.string(),
    startTime: zod_1.z.number(),
    endTime: zod_1.z.number(),
});
exports.analyzeJobSchema = zod_1.z.object({
    type: zod_1.z.literal('analyze'),
    videoId: zod_1.z.string(),
});
exports.notifyJobSchema = zod_1.z.object({
    type: zod_1.z.literal('notify'),
    userId: zod_1.z.string(),
    message: zod_1.z.string(),
});
exports.jobSchema = zod_1.z.union([
    exports.renderJobSchema,
    exports.clipJobSchema,
    exports.analyzeJobSchema,
    exports.notifyJobSchema,
]);
//# sourceMappingURL=schemas.js.map