import * as cheerio from "cheerio";
import { evaluateCondition, evaluateRule } from "./rules.js";
import type { DataItem, RuleCondition, RuleConfig, SourceConfig } from "./types.js";
import { getPath } from "./utils/object.js";

export type SandboxSampleType = "json" | "html";

export interface SandboxTestInput {
  sample: string;
  sampleType: SandboxSampleType;
  rule: RuleConfig;
  source?: SourceConfig;
}

export interface SandboxConditionResult {
  field: string;
  operator: RuleCondition["operator"];
  value?: unknown;
  actual?: unknown;
  passed: boolean;
  clause: "all" | "any";
}

export interface SandboxTestResult {
  matched: boolean;
  extractedFields: Record<string, unknown>;
  item: DataItem;
  conditions: SandboxConditionResult[];
}

export function testRuleInSandbox(input: SandboxTestInput): SandboxTestResult {
  const item = buildSandboxItem(input);
  const conditions = evaluateSandboxConditions(item, input.rule);
  const matched = evaluateRule(item, input.rule);

  return {
    matched,
    extractedFields: { ...item.data, title: item.title, url: item.url },
    item,
    conditions
  };
}

function buildSandboxItem(input: SandboxTestInput): DataItem {
  const observedAt = new Date().toISOString();
  const sourceId = input.rule.source;
  const sourceLabel = input.source?.label ?? sourceId;

  if (input.sampleType === "json") {
    const parsed = parseJsonSample(input.sample);
    const title = String(parsed.title ?? parsed.name ?? parsed.headline ?? "Sandbox item");
    const url = typeof parsed.url === "string" ? parsed.url : undefined;

    return {
      id: "sandbox-item",
      sourceId,
      sourceLabel,
      title,
      url,
      observedAt,
      data: parsed
    };
  }

  const extracted = extractHtmlFields(input.sample, input.source);
  return {
    id: "sandbox-item",
    sourceId,
    sourceLabel,
    title: String(extracted.title ?? extracted.name ?? "Sandbox item"),
    url: typeof extracted.url === "string" ? extracted.url : undefined,
    observedAt,
    data: extracted
  };
}

function parseJsonSample(sample: string): Record<string, unknown> {
  const trimmed = sample.trim();
  const parsed = JSON.parse(trimmed) as unknown;

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return {};
    }
    const first = parsed[0];
    if (first && typeof first === "object") {
      return first as Record<string, unknown>;
    }
    return { value: first };
  }

  if (parsed && typeof parsed === "object") {
    return parsed as Record<string, unknown>;
  }

  return { value: parsed };
}

function extractHtmlFields(sample: string, source?: SourceConfig): Record<string, unknown> {
  const $ = cheerio.load(sample);
  const fields: Record<string, unknown> = {};

  if (source?.type === "html") {
    const scope = source.itemSelector ? $(source.itemSelector).first() : $.root();
    for (const [name, config] of Object.entries(source.fields)) {
      const node = scope.find(config.selector).first();
      if (node.length === 0) {
        continue;
      }

      const raw = config.attr ? node.attr(config.attr) : node.text();
      fields[name] = applyHtmlTransform(raw ?? "", config.transform, source.baseUrl);
    }
    return fields;
  }

  const text = $.root().text().replace(/\s+/g, " ").trim();
  fields.text = text;
  fields.title = $("h1, h2, h3, title").first().text().trim() || text.slice(0, 80);
  const link = $("a[href]").first().attr("href");
  if (link) {
    fields.url = link;
  }

  const priceMatch = text.match(/[$£€]\s?[\d,.]+/);
  if (priceMatch) {
    fields.price = priceMatch[0];
  }

  return fields;
}

function applyHtmlTransform(
  value: string,
  transform: "text" | "number" | "price" | "percentage" | "absolute_url" | "lower" | "upper" | undefined,
  baseUrl?: string
): unknown {
  const trimmed = value.trim();
  switch (transform) {
    case "lower":
      return trimmed.toLowerCase();
    case "upper":
      return trimmed.toUpperCase();
    case "number":
    case "price":
    case "percentage":
      return trimmed;
    case "absolute_url":
      if (!trimmed) {
        return trimmed;
      }
      try {
        return baseUrl ? new URL(trimmed, baseUrl).toString() : new URL(trimmed).toString();
      } catch {
        return trimmed;
      }
    default:
      return trimmed;
  }
}

function evaluateSandboxConditions(item: DataItem, rule: RuleConfig): SandboxConditionResult[] {
  const all = (rule.all ?? []).map((condition) => ({
    ...condition,
    clause: "all" as const,
    actual: readSandboxField(item, condition.field),
    passed: evaluateCondition(item, condition)
  }));

  const any = (rule.any ?? []).map((condition) => ({
    ...condition,
    clause: "any" as const,
    actual: readSandboxField(item, condition.field),
    passed: evaluateCondition(item, condition)
  }));

  return [...all, ...any];
}

function readSandboxField(item: DataItem, field: string): unknown {
  if (field in item) {
    return (item as unknown as Record<string, unknown>)[field];
  }
  return getPath(item.data, field);
}