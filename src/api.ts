import type { DashboardRunResult } from "./dashboard.js";
import { getDashboardConfig, isDashboardAuthorized, runDashboardScrape } from "./dashboard.js";

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
