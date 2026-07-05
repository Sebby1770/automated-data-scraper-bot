import "dotenv/config";
import express, { type Request, type Response } from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createServer as createViteServer } from "vite";
import {
  getConfigResponse,
  getHealthResponse,
  readDashboardSecret,
  runScrapeResponse,
  type DashboardRequestBody
} from "./api.js";

const root = process.cwd();
const port = Number(process.env.PORT ?? 5173);
const isProduction = process.env.NODE_ENV === "production";

const app = express();
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json(getHealthResponse());
});

app.get("/api/config", (_request, response) => {
  try {
    response.json(getConfigResponse());
  } catch (error) {
    sendError(response, error);
  }
});

app.post("/api/run", async (request: Request<Record<string, never>, unknown, DashboardRequestBody>, response) => {
  try {
    const result = await runScrapeResponse(request.body ?? {}, readDashboardSecret(request.headers));
    response.status(result.ok ? 200 : 401).json(result);
  } catch (error) {
    sendError(response, error);
  }
});

if (isProduction) {
  const clientDir = resolve(root, "dist/client");
  app.use(express.static(clientDir));
  app.use((request, response, next) => {
    if (request.method !== "GET") {
      next();
      return;
    }

    const indexPath = resolve(clientDir, "index.html");
    if (!existsSync(indexPath)) {
      response.status(404).send("Dashboard build not found. Run npm run app:build first.");
      return;
    }

    response.sendFile(indexPath);
  });
} else {
  const vite = await createViteServer({
    root,
    appType: "spa",
    server: {
      middlewareMode: true
    }
  });
  app.use(vite.middlewares);
}

app.listen(port, () => {
  console.log(`Dashboard running at http://localhost:${port}`);
});

function sendError(response: Response, error: unknown): void {
  response.status(500).json({
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  });
}
