import type { Alert, DataItem, RuleCondition, RuleConfig } from "./types.js";
import type { PriceSnapshot } from "./state/price-history.js";
import { stableHash } from "./utils/hash.js";
import { getPath, toNumber } from "./utils/object.js";

export interface RuleEvaluationContext {
  getHistory?: (sourceId: string, itemId: string, field: string) => PriceSnapshot[];
  getPreviousText?: (sourceId: string, itemId: string, field: string) => string | undefined;
}

export interface RuleMatch {
  rule: RuleConfig;
  alert: Alert;
}

export function collectChangedFields(rules: RuleConfig[]): string[] {
  const fields = new Set<string>();
  for (const rule of rules) {
    for (const condition of [...(rule.all ?? []), ...(rule.any ?? [])]) {
      if (condition.operator === "changed") {
        fields.add(condition.field);
      }
    }
  }
  return [...fields];
}

export function evaluateRules(item: DataItem, rules: RuleConfig[], context?: RuleEvaluationContext): RuleMatch[] {
  return rules
    .filter((rule) => rule.source === item.sourceId)
    .filter((rule) => evaluateRule(item, rule, context))
    .map((rule) => {
      const alert = createAlert(item, rule);
      const changes = textChanges(item, rule, context);
      if (changes.length > 0) {
        const detail = changes.map((change) => `${change.field}: "${change.previous}" → "${change.current}"`).join("; ");
        alert.message = `${alert.message} (${detail})`;
        alert.changes = changes;
      }
      return { rule, alert };
    });
}

export function textChanges(item: DataItem, rule: RuleConfig, context?: RuleEvaluationContext) {
  const changes: Array<{ field: string; previous: string; current: string }> = [];
  for (const condition of [...(rule.all ?? []), ...(rule.any ?? [])]) {
    if (condition.operator !== "changed") {
      continue;
    }
    const previous = context?.getPreviousText?.(item.sourceId, item.id, condition.field);
    const current = String(readField(item, condition.field) ?? "");
    if (previous !== undefined && previous !== current) {
      changes.push({ field: condition.field, previous, current });
    }
  }
  return changes;
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
    case "starts_with":
      return String(candidate ?? "").toLowerCase().startsWith(String(condition.value ?? "").toLowerCase());
    case "ends_with":
      return String(candidate ?? "").toLowerCase().endsWith(String(condition.value ?? "").toLowerCase());
    case "between": {
      const current = toNumber(candidate);
      const range = Array.isArray(condition.value)
        ? condition.value
        : String(condition.value ?? "").split(",");
      const min = toNumber(range[0]);
      const max = toNumber(range[1]);
      return current !== undefined && min !== undefined && max !== undefined && current >= min && current <= max;
    }
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
    case "changed": {
      const previous = context?.getPreviousText?.(item.sourceId, item.id, condition.field);
      if (previous === undefined) {
        return false;
      }
      return previous !== String(candidate ?? "");
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
    matchedAt,
    severity: rule.severity ?? "info"
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