import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { Site } from "./Site.js";
import "./styles.css";

const path = window.location.pathname.replace(/\/+$/, "") || "/";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {path === "/console" ? <App /> : <Site />}
  </React.StrictMode>
);
