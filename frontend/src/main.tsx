import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./index.css";
import { startTelemetry, telemetryEnabled } from "./telemetry";

// Antes do render: as primeiras chamadas à API já saem com traceparent.
if (telemetryEnabled(import.meta.env)) startTelemetry();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
