import type { Alert, DataItem, RuleCondition, RuleConfig } from "./types.js";
import { stableHash } from "./utils/hash.js";
import { getPath, toNumber } from "./utils/object.js";

export interface RuleMatch {
  rule: RuleConfig;
  alert: Alert;
}

export function evaluateRules(item: DataItem, rules: RuleConfig[]): RuleMatch[] {
  return rules
    .filter((rule) => rule.source === item.sourceId)
    .filter((rule) => evaluateRule(item, rule))
    .map((rule) => ({
      rule,
      alert: createAlert(item, rule)
    }));
}

export function evaluateRule(item: DataItem, rule: RuleConfig): boolean {
  const all = rule.all ?? [];
  const any = rule.any ?? [];
  const allPass = all.length === 0 || all.every((condition) => evaluateCondition(item, condition));
  const anyPass = any.length === 0 || any.some((condition) => evaluateCondition(item, condition));
  return allPass && anyPass;
}

export function evaluateCondition(item: DataItem, condition: RuleCondition): boolean {
  const candidate = readField(item, condition.field);

  switch (condition.operator) {
    case "exists":
      return candidate !== undefined && candidate !== null && candidate !== "";
    case "contains":
      return String(candidate ?? "").toLowerCase().includes(String(condition.value ?? "").toLowerCase());
    case "not_contains":
      return !String(candidate ?? "").toLowerCase().includes(String(condition.value ?? "").toLowerCase());
    case "regex":
      return new RegExp(String(condition.value ?? ""), "i").test(String(candidate ?? ""));
    case "==":
      return String(candidate) === String(condition.value);
    case "!=":
      return String(candidate) !== String(condition.value);
    case "<":
      return compareNumbers(candidate, condition.value, (left, right) => left < right);
    case "<=":
      return compareNumbers(candidate, condition.value, (left, right) => left <= right);
    case ">":
      return compareNumbers(candidate, condition.value, (left, right) => left > right);
    case ">=":
      return compareNumbers(candidate, condition.value, (left, right) => left >= right);
  }
}

export function createAlert(item: DataItem, rule: RuleConfig): Alert {
  const message = renderTemplate(rule.message ?? defaultMessage(rule), item);
  const matchedAt = new Date().toISOString();
  const id = stableHash({
    sourceId: item.sourceId,
    itemId: item.id,
    ruleName: rule.name
  });

  return {
    id,
    ruleName: rule.name,
    sourceId: item.sourceId,
    sourceLabel: item.sourceLabel,
    title: item.title,
    url: item.url,
    message,
    item,
    matchedAt
  };
}

export function renderTemplate(template: string, item: DataItem): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const value = readField(item, path);
    if (value == null) {
      return "";
    }
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  });
}

function readField(item: DataItem, field: string): unknown {
  if (field in item) {
    return (item as unknown as Record<string, unknown>)[field];
  }
  return getPath(item.data, field);
}

function compareNumbers(left: unknown, right: unknown, comparator: (left: number, right: number) => boolean): boolean {
  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);
  return leftNumber !== undefined && rightNumber !== undefined && comparator(leftNumber, rightNumber);
}

function defaultMessage(rule: RuleConfig): string {
  return `Rule "${rule.name}" matched: {{title}} {{url}}`;
}
