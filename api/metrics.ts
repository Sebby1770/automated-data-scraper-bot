import "dotenv/config";
import { getMetricsResponse } from "../src/api.js";

interface VercelResponse {
  status(code: number): VercelResponse;
  setHeader(name: string, value: string): VercelResponse;
  send(payload: string): void;
}

export default function handler(_request: unknown, response: VercelResponse): void {
  response.status(200).setHeader("content-type", "text/plain; version=0.0.4; charset=utf-8");
  response.send(getMetricsResponse());
}