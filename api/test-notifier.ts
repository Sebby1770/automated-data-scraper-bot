import "dotenv/config";
import { readDashboardSecret, testNotifierResponse, type TestNotifierRequestBody } from "../src/api.js";

interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: TestNotifierRequestBody | string;
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
    const result = await testNotifierResponse(body, readDashboardSecret(request.headers));
    response.status(result.ok ? 200 : result.error === "Unauthorized" ? 401 : 400).json(result);
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function parseBody(body: VercelRequest["body"]): TestNotifierRequestBody {
  if (!body) {
    return { type: "discord" };
  }
  if (typeof body === "string") {
    return JSON.parse(body) as TestNotifierRequestBody;
  }
  return body;
}