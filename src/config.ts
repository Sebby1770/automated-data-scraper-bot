import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import type { BotConfig } from "./types.js";

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(["<", "<=", ">", ">=", "==", "!=", "contains", "not_contains", "regex", "exists"]),
  value: z.unknown().optional()
});

const settingsSchema = z
  .object({
    runIntervalSeconds: z.number().int().positive().default(300),
    userAgent: z.string().min(1).default("AutomatedDataScraperBot/0.1"),
    requestTimeoutMs: z.number().int().positive().default(12000),
    maxConcurrency: z.number().int().positive().default(4),
    stateTtlDays: z.number().int().positive().default(30),
    digestMode: z.boolean().default(false),
    priceHistoryFields: z.array(z.string().min(1)).default(["price"]),
    anomalyThresholdPercent: z.number().positive().default(20)
  })
  .default({});

const htmlFieldSchema = z.object({
  selector: z.string().min(1),
  attr: z.string().optional(),
  transform: z.enum(["text", "number", "price", "percentage", "absolute_url", "lower", "upper"]).optional()
});

const sourceSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("html"),
    label: z.string().optional(),
    url: z.string().url(),
    itemSelector: z.string().min(1),
    baseUrl: z.string().url().optional(),
    idFields: z.array(z.string().min(1)).optional(),
    fields: z.record(htmlFieldSchema)
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("rss"),
    label: z.string().optional(),
    url: z.string().url()
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("stooq"),
    label: z.string().optional(),
    symbol: z.string().min(1)
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("json"),
    label: z.string().optional(),
    url: z.string().url(),
    itemsPath: z.string().optional(),
    idFields: z.array(z.string().min(1)).optional(),
    fields: z.record(z.string().min(1))
  })
]);

const notifierSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("console"),
    enabled: z.boolean().optional()
  }),
  z.object({
    type: z.literal("discord"),
    enabled: z.boolean().optional(),
    webhookUrlEnv: z.string().default("DISCORD_WEBHOOK_URL")
  }),
  z.object({
    type: z.literal("telegram"),
    enabled: z.boolean().optional(),
    botTokenEnv: z.string().default("TELEGRAM_BOT_TOKEN"),
    chatIdEnv: z.string().default("TELEGRAM_CHAT_ID")
  }),
  z.object({
    type: z.literal("slack"),
    enabled: z.boolean().optional(),
    webhookUrlEnv: z.string().default("SLACK_WEBHOOK_URL")
  })
]);

const configSchema = z.object({
  settings: settingsSchema,
  sources: z.array(sourceSchema).min(1),
  rules: z
    .array(
      z.object({
        name: z.string().min(1),
        source: z.string().min(1),
        all: z.array(conditionSchema).optional(),
        any: z.array(conditionSchema).optional(),
        message: z.string().optional()
      })
    )
    .default([]),
  notifiers: z.array(notifierSchema).default([{ type: "console", enabled: true }])
});

export function resolveConfigPath(configPath?: string): string {
  const requested = configPath ?? process.env.CONFIG_PATH ?? "config.yml";
  const absolute = resolve(process.cwd(), requested);

  if (existsSync(absolute)) {
    return absolute;
  }

  const fallback = resolve(process.cwd(), "config.example.yml");
  if (existsSync(fallback)) {
    return fallback;
  }

  return absolute;
}

export function loadConfig(configPath?: string): BotConfig {
  const resolved = resolveConfigPath(configPath);
  const parsed = parse(readFileSync(resolved, "utf8")) as unknown;
  const config = configSchema.parse(parsed) as BotConfig;
  assertUniqueIds(config);
  assertRulesReferenceSources(config);
  return config;
}

function assertUniqueIds(config: BotConfig): void {
  const seen = new Set<string>();
  for (const source of config.sources) {
    if (seen.has(source.id)) {
      throw new Error(`Duplicate source id: ${source.id}`);
    }
    seen.add(source.id);
  }
}

function assertRulesReferenceSources(config: BotConfig): void {
  const sourceIds = new Set(config.sources.map((source) => source.id));
  for (const rule of config.rules) {
    if (!sourceIds.has(rule.source)) {
      throw new Error(`Rule "${rule.name}" references unknown source "${rule.source}"`);
    }
  }
}

export interface ConfigValidationIssue {
  level: "warning" | "error";
  message: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  issues: ConfigValidationIssue[];
}

export function validateConfig(configPath?: string): ConfigValidationResult {
  const issues: ConfigValidationIssue[] = [];

  try {
    const config = loadConfig(configPath);
    collectConfigIssues(config, issues);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({ level: "error", message });
  }

  const warnings = issues.filter((issue) => issue.level === "warning").map((issue) => issue.message);
  const errors = issues.filter((issue) => issue.level === "error").map((issue) => issue.message);

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    issues
  };
}

function collectConfigIssues(config: BotConfig, issues: ConfigValidationIssue[]): void {
  const sourceIds = new Set<string>();
  const ruleNames = new Set<string>();

  for (const source of config.sources) {
    if (sourceIds.has(source.id)) {
      issues.push({ level: "error", message: `Duplicate source id: ${source.id}` });
    }
    sourceIds.add(source.id);
  }

  for (const rule of config.rules) {
    if (ruleNames.has(rule.name)) {
      issues.push({ level: "warning", message: `Duplicate rule name: ${rule.name}` });
    }
    ruleNames.add(rule.name);

    if (!sourceIds.has(rule.source)) {
      issues.push({ level: "error", message: `Rule "${rule.name}" references unknown source "${rule.source}"` });
    }

    const conditionCount = (rule.all?.length ?? 0) + (rule.any?.length ?? 0);
    if (conditionCount === 0) {
      issues.push({ level: "warning", message: `Rule "${rule.name}" has no all/any conditions` });
    }
  }

  if (config.rules.length === 0) {
    issues.push({ level: "warning", message: "No rules configured; scrapes will not produce alerts" });
  }

  for (const notifier of config.notifiers) {
    if (notifier.enabled === false) {
      continue;
    }

    if (notifier.type === "discord") {
      const envName = notifier.webhookUrlEnv ?? "DISCORD_WEBHOOK_URL";
      if (!process.env[envName]) {
        issues.push({ level: "warning", message: `Discord notifier enabled but ${envName} is not set` });
      }
    }

    if (notifier.type === "telegram") {
      const tokenEnv = notifier.botTokenEnv ?? "TELEGRAM_BOT_TOKEN";
      const chatEnv = notifier.chatIdEnv ?? "TELEGRAM_CHAT_ID";
      if (!process.env[tokenEnv]) {
        issues.push({ level: "warning", message: `Telegram notifier enabled but ${tokenEnv} is not set` });
      }
      if (!process.env[chatEnv]) {
        issues.push({ level: "warning", message: `Telegram notifier enabled but ${chatEnv} is not set` });
      }
    }

    if (notifier.type === "slack") {
      const envName = notifier.webhookUrlEnv ?? "SLACK_WEBHOOK_URL";
      if (!process.env[envName]) {
        issues.push({ level: "warning", message: `Slack notifier enabled but ${envName} is not set` });
      }
    }
  }

  if (config.settings.runIntervalSeconds < 60) {
    issues.push({
      level: "warning",
      message: `runIntervalSeconds is ${config.settings.runIntervalSeconds}; consider >= 60 for polite scraping`
    });
  }
}
