import "dotenv/config";
import { getConfigValidationResponse } from "../../src/api.js";

interface VercelResponse {
  status(code: number): VercelResponse;
  json(payload: unknown): void;
}

export default function handler(_request: unknown, response: VercelResponse): void {
  try {
    response.status(200).json(getConfigValidationResponse());
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}