import "dotenv/config";
import { previewHttpStatus, previewSourceResponse, readDashboardSecret, type PreviewRequestBody } from "../src/api.js";

interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: PreviewRequestBody | string;
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
    const result = await previewSourceResponse(parseBody(request.body), readDashboardSecret(request.headers));
    response.status(previewHttpStatus(result)).json(result);
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function parseBody(body: VercelRequest["body"]): PreviewRequestBody {
  if (!body) {
    return {};
  }
  if (typeof body === "string") {
    return JSON.parse(body) as PreviewRequestBody;
  }
  return body;
}
