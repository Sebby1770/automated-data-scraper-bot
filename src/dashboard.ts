import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { loadConfig } from "./config.js";
import { runOnce } from "./runner.js";
import { createMemoryPriceHistoryStore } from "./state/price-history.js";
import { MemoryStateStore } from "./state/memory.js";
import type { BotConfig, NotifierConfig, RunSummary, SourceConfig } from "./types.js";

export interface DashboardSource {
  id: string;
  type: SourceConfig["type"];
  label: string;
  target: string;
  detail: string;
  fieldCount?: number;
}

export interface DashboardRule {
  name: string;
  source: string;
  allCount: number;
  anyCount: number;
  message?: string;
}

export interface DashboardNotifier {
  type: NotifierConfig["type"];
  enabled: boolean;
  ready: boolean;
  missingEnv: string[];
}

export interface DashboardConfig {
  loadedAt: string;
  secured: boolean;
  settings: BotConfig["settings"] & {
    digestMode: boolean;
    priceHistoryFields: string[];
    anomalyThresholdPercent: number;
  };
  sources: DashboardSource[];
  rules: DashboardRule[];
  notifiers: DashboardNotifier[];
  cronSchedule?: string;
}

export interface DashboardRunResult {
  dryRun: boolean;
  summary: RunSummary;
}

export function getDashboardConfig(configPath?: string): DashboardConfig {
  const config = loadConfig(configPath);

  return {
    loadedAt: new Date().toISOString(),
    secured: Boolean(process.env.DASHBOARD_SECRET),
    settings: {
      ...config.settings,
      digestMode: config.settings.digestMode ?? false,
      priceHistoryFields: config.settings.priceHistoryFields ?? ["price"],
      anomalyThresholdPercent: config.settings.anomalyThresholdPercent ?? 20
    },
    sources: config.sources.map(summarizeSource),
    rules: config.rules.map((rule) => ({
      name: rule.name,
      source: rule.source,
      allCount: rule.all?.length ?? 0,
      anyCount: rule.any?.length ?? 0,
      message: rule.message
    })),
    notifiers: config.notifiers.map(summarizeNotifier),
    cronSchedule: readCronSchedule()
  };
}

export async function runDashboardScrape(options: { configPath?: string; dryRun?: boolean }): Promise<DashboardRunResult> {
  const dryRun = options.dryRun !== false;
  const config = loadConfig(options.configPath);
  const summary = await runOnce(config, {
    dryRun,
    includeAlerts: true,
    stateStore: dryRun ? new MemoryStateStore() : undefined,
    priceHistoryStore: dryRun ? createMemoryPriceHistoryStore() : undefined
  });

  return {
    dryRun,
    summary
  };
}

export function isDashboardAuthorized(providedSecret?: string): boolean {
  const expectedSecret = process.env.DASHBOARD_SECRET;
  if (!expectedSecret) {
    return true;
  }

  return providedSecret === expectedSecret || providedSecret === `Bearer ${expectedSecret}`;
}

function summarizeSource(source: SourceConfig): DashboardSource {
  if (source.type === "html") {
    return {
      id: source.id,
      type: source.type,
      label: source.label ?? source.id,
      target: source.url,
      detail: source.itemSelector,
      fieldCount: Object.keys(source.fields).length
    };
  }

  if (source.type === "rss") {
    return {
      id: source.id,
      type: source.type,
      label: source.label ?? source.id,
      target: source.url,
      detail: "RSS feed"
    };
  }

  if (source.type === "json") {
    return {
      id: source.id,
      type: source.type,
      label: source.label ?? source.id,
      target: source.url,
      detail: source.itemsPath ? `items at ${source.itemsPath}` : "JSON root",
      fieldCount: Object.keys(source.fields).length
    };
  }

  return {
    id: source.id,
    type: source.type,
    label: source.label ?? source.id,
    target: source.symbol,
    detail: "Stooq quote"
  };
}

function summarizeNotifier(notifier: NotifierConfig): DashboardNotifier {
  const enabled = notifier.enabled !== false;

  if (notifier.type === "discord") {
    const envName = notifier.webhookUrlEnv ?? "DISCORD_WEBHOOK_URL";
    return {
      type: notifier.type,
      enabled,
      ready: enabled && Boolean(process.env[envName]),
      missingEnv: enabled && !process.env[envName] ? [envName] : []
    };
  }

  if (notifier.type === "telegram") {
    const tokenEnv = notifier.botTokenEnv ?? "TELEGRAM_BOT_TOKEN";
    const chatEnv = notifier.chatIdEnv ?? "TELEGRAM_CHAT_ID";
    const missingEnv = [tokenEnv, chatEnv].filter((envName) => !process.env[envName]);
    return {
      type: notifier.type,
      enabled,
      ready: enabled && missingEnv.length === 0,
      missingEnv: enabled ? missingEnv : []
    };
  }

  if (notifier.type === "slack") {
    const envName = notifier.webhookUrlEnv ?? "SLACK_WEBHOOK_URL";
    return {
      type: notifier.type,
      enabled,
      ready: enabled && Boolean(process.env[envName]),
      missingEnv: enabled && !process.env[envName] ? [envName] : []
    };
  }

  return {
    type: notifier.type,
    enabled,
    ready: enabled,
    missingEnv: []
  };
}

function readCronSchedule(): string | undefined {
  try {
    const raw = readFileSync(resolve(process.cwd(), "vercel.json"), "utf8");
    const parsed = parse(raw) as { crons?: Array<{ path: string; schedule: string }> };
    return parsed.crons?.find((cron) => cron.path === "/api/cron/scrape")?.schedule;
  } catch {
    return undefined;
  }
}
