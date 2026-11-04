import { prepareRequest } from "../politeness.js";
import { fetchText, fetchTextConditional } from "../utils/http.js";
import type { SourceRuntimeOptions } from "./types.js";

export async function fetchSourceText(url: string, options: SourceRuntimeOptions): Promise<string> {
  await prepareRequest(url, options);
  if (options.conditionalRequests) {
    const result = await fetchTextConditional(url, options.userAgent, options.requestTimeoutMs);
    return result.body;
  }
  return fetchText(url, options.userAgent, options.requestTimeoutMs);
}
