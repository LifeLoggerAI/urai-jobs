"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Apply;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var applications_1 = require("../lib/applications");
var AuthContext_1 = require("../context/AuthContext");
function Apply() {
    var _a = (0, react_router_dom_1.useParams)().jobId, jobId = _a === void 0 ? "" : _a;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var user = (0, AuthContext_1.useAuth)().user;
    var _b = (0, react_1.useState)(null), resumeFile = _b[0], setResumeFile = _b[1];
    var _c = (0, react_1.useState)(""), error = _c[0], setError = _c[1];
    var _d = (0, react_1.useState)(false), submitting = _d[0], setSubmitting = _d[1];
    function handleSubmit(e) {
        return __awaiter(this, void 0, void 0, function () {
            var err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        e.preventDefault();
                        if (!user) {
                            setError("You must be logged in to apply.");
                            return [2 /*return*/];
                        }
                        if (!jobId) {
                            setError("Missing job id.");
                            return [2 /*return*/];
                        }
                        if (!resumeFile) {
                            setError("Please attach a resume.");
                            return [2 /*return*/];
                        }
                        setError("");
                        setSubmitting(true);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, (0, applications_1.submitApplication)({
                                userId: user.uid,
                                jobId: jobId,
                                file: resumeFile,
                            })];
                    case 2:
                        _a.sent();
                        navigate("/jobs/".concat(jobId), { replace: true });
                        return [3 /*break*/, 5];
                    case 3:
                        err_1 = _a.sent();
                        setError(err_1 instanceof Error ? err_1.message : "Application submission failed");
                        return [3 /*break*/, 5];
                    case 4:
                        setSubmitting(false);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    return (<form onSubmit={handleSubmit}>
      <h1>Apply</h1>
      {error ? <p role="alert">{error}</p> : null}
      <label htmlFor="resume">Resume</label>
      <input id="resume" type="file" accept=".pdf,.doc,.docx" onChange={function (e) { var _a, _b; return setResumeFile((_b = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : null); }} required/>
      <button type="submit" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit Application"}
      </button>
    </form>);
}
