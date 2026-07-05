import type { DashboardRunResult } from "./dashboard.js";
import { getDashboardConfig, isDashboardAuthorized, runDashboardScrape } from "./dashboard.js";

export const APP_VERSION = "0.2.0";

export interface HealthResponse {
  version: string;
  uptime: number;
}

export interface DashboardRequestBody {
  dryRun?: boolean;
}

export interface DashboardApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function readDashboardSecret(headers: Record<string, string | string[] | undefined>): string | undefined {
  const value =
    headers["x-dashboard-secret"] ??
    headers["X-Dashboard-Secret"] ??
    headers.authorization ??
    headers.Authorization;

  return Array.isArray(value) ? value[0] : value;
}

export function getConfigResponse(): DashboardApiResponse<ReturnType<typeof getDashboardConfig>> {
  return {
    ok: true,
    data: getDashboardConfig(process.env.CONFIG_PATH)
  };
}

export function getHealthResponse(): DashboardApiResponse<HealthResponse> {
  return {
    ok: true,
    data: {
      version: APP_VERSION,
      uptime: process.uptime()
    }
  };
}

export async function runScrapeResponse(
  body: DashboardRequestBody,
  providedSecret?: string
): Promise<DashboardApiResponse<DashboardRunResult>> {
  if (!isDashboardAuthorized(providedSecret)) {
    return {
      ok: false,
      error: "Unauthorized"
    };
  }

  return {
    ok: true,
    data: await runDashboardScrape({
      configPath: process.env.CONFIG_PATH,
      dryRun: body.dryRun
    })
  };
}
