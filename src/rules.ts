import type { Alert, DataItem, RuleCondition, RuleConfig } from "./types.js";
import type { PriceSnapshot } from "./state/price-history.js";
import { stableHash } from "./utils/hash.js";
import { getPath, toNumber } from "./utils/object.js";

export interface RuleEvaluationContext {
  getHistory?: (sourceId: string, itemId: string, field: string) => PriceSnapshot[];
}

export interface RuleMatch {
  rule: RuleConfig;
  alert: Alert;
}

export function evaluateRules(item: DataItem, rules: RuleConfig[], context?: RuleEvaluationContext): RuleMatch[] {
  return rules
    .filter((rule) => rule.source === item.sourceId)
    .filter((rule) => evaluateRule(item, rule, context))
    .map((rule) => ({
      rule,
      alert: createAlert(item, rule)
    }));
}

export function evaluateRule(item: DataItem, rule: RuleConfig, context?: RuleEvaluationContext): boolean {
  const all = rule.all ?? [];
  const any = rule.any ?? [];
  const allPass = all.length === 0 || all.every((condition) => evaluateCondition(item, condition, context));
  const anyPass = any.length === 0 || any.some((condition) => evaluateCondition(item, condition, context));
  return allPass && anyPass;
}

export function evaluateCondition(item: DataItem, condition: RuleCondition, context?: RuleEvaluationContext): boolean {
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
    case "increased":
      return compareToHistory(item, condition.field, context, (current, previous) => current > previous);
    case "decreased":
      return compareToHistory(item, condition.field, context, (current, previous) => current < previous);
    case "changed_by": {
      const threshold = toNumber(condition.value);
      return (
        threshold !== undefined &&
        compareToHistory(item, condition.field, context, (current, previous) => Math.abs(current - previous) >= threshold)
      );
    }
    case "changed_pct": {
      const threshold = toNumber(condition.value);
      return (
        threshold !== undefined &&
        compareToHistory(item, condition.field, context, (current, previous) => {
          if (previous === 0) {
            return false;
          }
          const changePercent = Math.abs(((current - previous) / previous) * 100);
          return changePercent >= threshold;
        })
      );
    }
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

export function getPreviousHistoryValue(
  item: DataItem,
  field: string,
  context?: RuleEvaluationContext
): { current: number; previous: number } | undefined {
  const current = toNumber(readField(item, field));
  if (current === undefined) {
    return undefined;
  }

  const history = context?.getHistory?.(item.sourceId, item.id, field) ?? [];
  if (history.length < 2) {
    return undefined;
  }

  const previous = history[history.length - 2]?.value;
  if (previous === undefined) {
    return undefined;
  }

  return { current, previous };
}

function compareToHistory(
  item: DataItem,
  field: string,
  context: RuleEvaluationContext | undefined,
  comparator: (current: number, previous: number) => boolean
): boolean {
  const values = getPreviousHistoryValue(item, field, context);
  if (!values) {
    return false;
  }

  return comparator(values.current, values.previous);
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