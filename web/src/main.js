import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
const root = document.getElementById("root");
if (!root) {
    document.body.innerHTML = "<pre>URAI Jobs failed: missing #root element.</pre>";
}
else {
    ReactDOM.createRoot(root).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
}
