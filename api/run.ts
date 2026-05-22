import "dotenv/config";
import { readDashboardSecret, runScrapeResponse, type DashboardRequestBody } from "../src/api.js";

interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: DashboardRequestBody | string;
}

interface VercelResponse {
  status(code: number): VercelResponse;
  json(payload: unknown): void;
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method && request.method !== "POST") {
    response.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const body = parseBody(request.body);
    const result = await runScrapeResponse(body, readDashboardSecret(request.headers));
    response.status(result.ok ? 200 : 401).json(result);
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function parseBody(body: VercelRequest["body"]): DashboardRequestBody {
  if (!body) {
    return {};
  }
  if (typeof body === "string") {
    return JSON.parse(body) as DashboardRequestBody;
  }
  return body;
}
