import { resolve } from "node:path";
import {
  loadConfig,
  listConfigProfiles,
  resolveConfigPath,
  validateConfig,
  type ConfigProfile,
  type ConfigValidationResult
} from "./config.js";
import type { DashboardRunResult } from "./dashboard.js";
import { getDashboardConfig, isDashboardAuthorized, runDashboardScrape } from "./dashboard.js";
import { buildDigestPreview } from "./digest.js";
import { nlRuleToYaml, parseNlRule, type ParsedNlRule } from "./nl-rules.js";
import { formatPrometheusMetrics } from "./metrics.js";
import { sendTestNotification, type TestableNotifierType } from "./notifiers/index.js";
import { testRuleInSandbox, type SandboxSampleType, type SandboxTestResult } from "./sandbox.js";
import type { RuleConfig } from "./types.js";

export const APP_VERSION = "0.5.0";

export interface HealthResponse {
  version: string;
  uptime: number;
}

export interface DashboardRequestBody {
  dryRun?: boolean;
  configPath?: string;
}

export interface TestNotifierRequestBody {
  type: TestableNotifierType;
}

export interface NlRuleRequestBody {
  text: string;
  source?: string;
  name?: string;
}

export interface NlRuleResponse {
  parsed?: ParsedNlRule;
  yaml?: string;
  error?: string;
}

export interface SandboxTestRequestBody {
  sample: string;
  sampleType: SandboxSampleType;
  ruleName: string;
}

export interface DigestPreviewRequestBody {
  alerts: Array<{
    ruleName: string;
    title: string;
  }>;
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

function resolveRequestConfigPath(configPath?: string): string | undefined {
  return configPath?.trim() || process.env.CONFIG_PATH;
}

export function getConfigResponse(configPath?: string): DashboardApiResponse<ReturnType<typeof getDashboardConfig>> {
  return {
    ok: true,
    data: getDashboardConfig(resolveRequestConfigPath(configPath))
  };
}

export function getConfigProfilesResponse(): DashboardApiResponse<{
  activePath: string;
  profiles: ConfigProfile[];
}> {
  const activePath = resolveConfigPath(process.env.CONFIG_PATH);
  const profiles = listConfigProfiles();

  return {
    ok: true,
    data: {
      activePath: profiles.find((profile) => resolve(process.cwd(), profile.path) === activePath)?.path ?? process.env.CONFIG_PATH ?? "config.yml",
      profiles
    }
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
      configPath: resolveRequestConfigPath(body.configPath),
      dryRun: body.dryRun
    })
  };
}

export function getConfigValidationResponse(configPath?: string): DashboardApiResponse<ConfigValidationResult> {
  return {
    ok: true,
    data: validateConfig(resolveRequestConfigPath(configPath))
  };
}

export function getMetricsResponse(): string {
  return formatPrometheusMetrics();
}

export function parseNlRuleResponse(body: NlRuleRequestBody): DashboardApiResponse<NlRuleResponse> {
  if (!body.text?.trim()) {
    return {
      ok: false,
      error: "Missing rule description text"
    };
  }

  const outcome = parseNlRule(body.text);
  if (!outcome.ok) {
    return {
      ok: true,
      data: {
        error: outcome.error
      }
    };
  }

  return {
    ok: true,
    data: {
      parsed: outcome.rule,
      yaml: nlRuleToYaml(outcome.rule, {
        source: body.source,
        name: body.name
      })
    }
  };
}

export function sandboxTestResponse(body: SandboxTestRequestBody): DashboardApiResponse<SandboxTestResult> {
  if (!body.sample?.trim()) {
    return {
      ok: false,
      error: "Missing sample content"
    };
  }

  if (!body.ruleName?.trim()) {
    return {
      ok: false,
      error: "Missing rule name"
    };
  }

  try {
    const config = loadConfig(process.env.CONFIG_PATH);
    const rule = config.rules.find((entry) => entry.name === body.ruleName);
    if (!rule) {
      return {
        ok: false,
        error: `Rule not found: ${body.ruleName}`
      };
    }

    const source = config.sources.find((entry) => entry.id === rule.source);
    const result = testRuleInSandbox({
      sample: body.sample,
      sampleType: body.sampleType,
      rule: rule as RuleConfig,
      source
    });

    return {
      ok: true,
      data: result
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function digestPreviewResponse(
  body: DigestPreviewRequestBody
): DashboardApiResponse<ReturnType<typeof buildDigestPreview>> {
  const alerts = (body.alerts ?? []).map((entry, index) => ({
    id: `preview-${index}`,
    ruleName: entry.ruleName,
    sourceId: "preview",
    sourceLabel: "Preview",
    title: entry.title,
    message: entry.title,
    matchedAt: new Date().toISOString(),
    item: {
      id: `preview-item-${index}`,
      sourceId: "preview",
      sourceLabel: "Preview",
      title: entry.title,
      observedAt: new Date().toISOString(),
      data: {}
    }
  }));

  return {
    ok: true,
    data: buildDigestPreview(alerts)
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

  if (!body.type || !["discord", "telegram", "slack", "webhook"].includes(body.type)) {
    return {
      ok: false,
      error: 'Invalid notifier type. Expected "discord", "telegram", "slack", or "webhook".'
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
