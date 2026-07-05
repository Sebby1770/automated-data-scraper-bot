import "dotenv/config";
import { getHealthResponse } from "../src/api.js";

interface VercelResponse {
  status(code: number): VercelResponse;
  json(payload: unknown): void;
}

export default function handler(_request: unknown, response: VercelResponse): void {
  response.status(200).json(getHealthResponse());
}