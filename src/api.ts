import { validateConfig, type ConfigValidationResult } from "./config.js";
import type { DashboardRunResult } from "./dashboard.js";
import { getDashboardConfig, isDashboardAuthorized, runDashboardScrape } from "./dashboard.js";
import { sendTestNotification, type TestableNotifierType } from "./notifiers/index.js";

export const APP_VERSION = "0.3.0";

export interface HealthResponse {
  version: string;
  uptime: number;
}

export interface DashboardRequestBody {
  dryRun?: boolean;
}

export interface TestNotifierRequestBody {
  type: TestableNotifierType;
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

export function getConfigValidationResponse(): DashboardApiResponse<ConfigValidationResult> {
  return {
    ok: true,
    data: validateConfig(process.env.CONFIG_PATH)
  };
}

export async function testNotifierResponse(
  body: TestNotifierRequestBody,
  providedSecret?: string
): Promise<DashboardApiResponse<{ type: TestableNotifierType; sentAt: string }>> {
  if (!isDashboardAuthorized(providedSecret)) {
    return {
      ok: false,
      error: "Unauthorized"
    };
  }

  if (!body.type || !["discord", "telegram", "slack"].includes(body.type)) {
    return {
      ok: false,
      error: 'Invalid notifier type. Expected "discord", "telegram", or "slack".'
    };
  }

  try {
    await sendTestNotification(body.type);
    return {
      ok: true,
      data: {
        type: body.type,
        sentAt: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
