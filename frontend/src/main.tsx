// Primeiro import de propósito: liga a telemetria antes de o router disparar o /api/me (ver telemetry-init.ts).
import "./telemetry-init";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
