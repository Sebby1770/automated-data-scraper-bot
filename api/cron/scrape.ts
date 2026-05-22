import "dotenv/config";
import { loadConfig } from "../../src/config.js";
import { runOnce } from "../../src/runner.js";

interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  status(code: number): VercelResponse;
  json(payload: unknown): void;
  send(payload: unknown): void;
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method && request.method !== "GET") {
    response.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const expectedSecret = process.env.CRON_SECRET;
  const authorization = readHeader(request, "authorization");

  if (expectedSecret && authorization !== `Bearer ${expectedSecret}`) {
    response.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  if (!expectedSecret && process.env.VERCEL) {
    response.status(500).json({ ok: false, error: "CRON_SECRET is required in production" });
    return;
  }

  try {
    const config = loadConfig(process.env.CONFIG_PATH);
    const summary = await runOnce(config);
    response.status(summary.errors.length > 0 ? 207 : 200).json({
      ok: summary.errors.length === 0,
      summary
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function readHeader(request: VercelRequest, name: string): string | undefined {
  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
