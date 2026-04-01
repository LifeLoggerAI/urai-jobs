"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
var react_router_dom_1 = require("react-router-dom");
var LoginPage_1 = require("./pages/LoginPage");
var SignupPage_1 = require("./pages/SignupPage");
var JobBoard_1 = require("./pages/JobBoard");
var JobDetail_1 = require("./pages/JobDetail");
var Apply_1 = require("./pages/Apply");
var ProtectedRoute_1 = require("./components/ProtectedRoute");
var AuthContext_1 = require("./context/AuthContext");
function App() {
    return (<react_router_dom_1.BrowserRouter>
      <AuthContext_1.AuthProvider>
        <react_router_dom_1.Routes>
          <react_router_dom_1.Route path="/" element={<react_router_dom_1.Navigate to="/jobs" replace/>}/>
          <react_router_dom_1.Route path="/login" element={<LoginPage_1.default />}/>
          <react_router_dom_1.Route path="/signup" element={<SignupPage_1.default />}/>
          <react_router_dom_1.Route path="/jobs" element={<JobBoard_1.default />}/>
          <react_router_dom_1.Route path="/jobs/:jobId" element={<JobDetail_1.default />}/>
          <react_router_dom_1.Route path="/jobs/:jobId/apply" element={<ProtectedRoute_1.default>
                <Apply_1.default />
              </ProtectedRoute_1.default>}/>
          <react_router_dom_1.Route path="*" element={<react_router_dom_1.Navigate to="/jobs" replace/>}/>
        </react_router_dom_1.Routes>
      </AuthContext_1.AuthProvider>
    </react_router_dom_1.BrowserRouter>);
}
