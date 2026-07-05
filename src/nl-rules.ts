import type { RuleCondition, RuleOperator } from "./types.js";

export interface ParsedNlRule {
  field: string;
  operator: RuleOperator;
  value?: unknown;
  confidence: "high" | "medium" | "low";
  raw: string;
}

export interface NlParseResult {
  ok: true;
  rule: ParsedNlRule;
}

export interface NlParseError {
  ok: false;
  error: string;
}

export type NlParseOutcome = NlParseResult | NlParseError;

interface OperatorPhrase {
  operator: RuleOperator;
  patterns: RegExp[];
}

const OPERATOR_PHRASES: OperatorPhrase[] = [
  {
    operator: "<",
    patterns: [/\b(?:is\s+)?below\b/i, /\bunder\b/i, /\bless\s+than\b/i, /\blower\s+than\b/i, /\bdrops?\s+below\b/i]
  },
  {
    operator: "<=",
    patterns: [/\b(?:is\s+)?at\s+most\b/i, /\bat\s+or\s+below\b/i, /\bno\s+more\s+than\b/i, /\bup\s+to\b/i]
  },
  {
    operator: ">",
    patterns: [/\b(?:is\s+)?above\b/i, /\bover\b/i, /\bgreater\s+than\b/i, /\bhigher\s+than\b/i, /\bexceeds?\b/i]
  },
  {
    operator: ">=",
    patterns: [/\b(?:is\s+)?at\s+least\b/i, /\bat\s+or\s+above\b/i, /\bno\s+less\s+than\b/i]
  },
  {
    operator: "==",
    patterns: [/\b(?:is\s+)?equal\s+to\b/i, /\b(?:is\s+)?exactly\b/i, /\bmatches?\b/i, /\bequals?\b/i]
  },
  {
    operator: "!=",
    patterns: [/\b(?:is\s+)?not\s+equal\s+to\b/i, /\bdoes\s+not\s+equal\b/i, /\bisn't\b/i, /\bis\s+not\b/i]
  },
  {
    operator: "contains",
    patterns: [/\bcontains?\b/i, /\bincludes?\b/i, /\bhas\b/i, /\bmentions?\b/i]
  },
  {
    operator: "not_contains",
    patterns: [/\bdoes\s+not\s+contain\b/i, /\bdoesn't\s+contain\b/i, /\bwithout\b/i, /\blacks?\b/i]
  },
  {
    operator: "regex",
    patterns: [/\bmatches?\s+pattern\b/i, /\bregex\b/i, /\bregular\s+expression\b/i]
  },
  {
    operator: "exists",
    patterns: [/\bexists?\b/i, /\bis\s+present\b/i, /\bis\s+set\b/i, /\bhas\s+a\s+value\b/i]
  }
];

const FIELD_ALIASES: Record<string, string> = {
  cost: "price",
  amount: "price",
  headline: "title",
  name: "title",
  description: "summary",
  body: "summary",
  content: "summary",
  link: "url",
  href: "url"
};

const LEADING_PREFIX = /^(?:please\s+)?(?:alert|notify|warn|watch|trigger)(?:\s+me)?(?:\s+when|\s+if|\s+on)?\s*/i;

export function parseNlRule(text: string): NlParseOutcome {
  const raw = text.trim();
  if (!raw) {
    return { ok: false, error: "Enter a rule description, e.g. \"alert when price is below 50\"" };
  }

  const normalized = raw.replace(LEADING_PREFIX, "").trim();
  const operatorMatch = findOperator(normalized);
  if (!operatorMatch) {
    return {
      ok: false,
      error: "Could not detect an operator. Try phrases like \"below 50\", \"contains apartment\", or \"exists\"."
    };
  }

  const field = extractField(normalized, operatorMatch);
  if (!field) {
    return {
      ok: false,
      error: "Could not detect a field name. Mention a field like price, title, or summary."
    };
  }

  const value = extractValue(normalized, operatorMatch, field);
  if (operatorMatch.operator !== "exists" && value === undefined) {
    return {
      ok: false,
      error: `Detected "${operatorMatch.operator}" on "${field}" but could not parse a comparison value.`
    };
  }

  const confidence = scoreConfidence(raw, field, operatorMatch.operator, value);

  return {
    ok: true,
    rule: {
      field,
      operator: operatorMatch.operator,
      value,
      confidence,
      raw
    }
  };
}

export function parsedNlRuleToCondition(rule: ParsedNlRule): RuleCondition {
  return {
    field: rule.field,
    operator: rule.operator,
    ...(rule.value !== undefined ? { value: rule.value } : {})
  };
}

export function nlRuleToYaml(
  rule: ParsedNlRule,
  options: { name?: string; source?: string; message?: string } = {}
): string {
  const ruleName = options.name?.trim() || "Natural language rule";
  const source = options.source?.trim() || "source-id";
  const condition = parsedNlRuleToCondition(rule);
  const valueLine =
    condition.value !== undefined ? `\n        value: ${formatYamlValue(condition.value)}` : "";
  const messageLine = options.message?.trim() ? `\n    message: ${JSON.stringify(options.message.trim())}` : "";

  return [
    "  - name: " + JSON.stringify(ruleName),
    "    source: " + source,
    "    all:",
    "      - field: " + condition.field,
    `        operator: ${condition.operator}${valueLine}${messageLine}`
  ].join("\n");
}

function findOperator(text: string): { operator: RuleOperator; phrase: string } | undefined {
  let best: { operator: RuleOperator; phrase: string; index: number } | undefined;

  for (const entry of OPERATOR_PHRASES) {
    for (const pattern of entry.patterns) {
      const match = pattern.exec(text);
      if (!match || match.index === undefined) {
        continue;
      }

      if (!best || match.index < best.index) {
        best = {
          operator: entry.operator,
          phrase: match[0],
          index: match.index
        };
      }
    }
  }

  return best ? { operator: best.operator, phrase: best.phrase } : undefined;
}

function extractField(text: string, operatorMatch: { operator: RuleOperator; phrase: string }): string | undefined {
  const beforeOperator = text.slice(0, text.toLowerCase().indexOf(operatorMatch.phrase.toLowerCase())).trim();
  const afterOperator = text.slice(text.toLowerCase().indexOf(operatorMatch.phrase.toLowerCase()) + operatorMatch.phrase.length).trim();

  const candidates = [
    ...collectFieldTokens(beforeOperator),
    ...collectFieldTokens(afterOperator)
  ];

  if (candidates.length === 0) {
    return operatorMatch.operator === "exists" ? guessFieldFromContext(text) : undefined;
  }

  const token = candidates[0];
  return FIELD_ALIASES[token.toLowerCase()] ?? token;
}

function collectFieldTokens(segment: string): string[] {
  const cleaned = segment
    .replace(/\b(?:the|a|an|when|if|field|value|of|for)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return [];
  }

  const tokens = cleaned.match(/[A-Za-z][\w.-]*/g) ?? [];
  return tokens.filter((token) => !isStopWord(token));
}

function guessFieldFromContext(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const field of ["price", "title", "summary", "url", "symbol"]) {
    if (lower.includes(field)) {
      return field;
    }
  }
  return undefined;
}

function extractValue(
  text: string,
  operatorMatch: { operator: RuleOperator; phrase: string },
  field: string
): unknown {
  if (operatorMatch.operator === "exists") {
    return undefined;
  }

  const phraseIndex = text.toLowerCase().indexOf(operatorMatch.phrase.toLowerCase());
  const tail = text.slice(phraseIndex + operatorMatch.phrase.length).trim();
  const head = text.slice(0, phraseIndex).trim();

  const tailQuoted = tail.match(/^["']([^"']+)["']/);
  if (tailQuoted) {
    return tailQuoted[1];
  }

  const tailWord = tail.match(/^([A-Za-z][\w\s-]*?)(?:\s+(?:and|or|then)\b|$)/) ?? tail.match(/^([A-Za-z][\w\s-]+)/);
  if (
    tailWord &&
    (operatorMatch.operator === "contains" ||
      operatorMatch.operator === "not_contains" ||
      operatorMatch.operator === "regex" ||
      operatorMatch.operator === "==")
  ) {
    const candidate = tailWord[1].trim();
    if (candidate && candidate.toLowerCase() !== field.toLowerCase()) {
      return candidate;
    }
  }

  const numericTail = tail.match(/^[$£€]?\s*([\d,]+(?:\.\d+)?)\s*%?/);
  if (numericTail) {
    return parseNumericToken(numericTail[1]);
  }

  const numericHead = head.match(/(?:^|\s)[$£€]?\s*([\d,]+(?:\.\d+)?)\s*%?\s*$/);
  if (numericHead) {
    return parseNumericToken(numericHead[1]);
  }

  const quotedHead = head.match(/["']([^"']+)["']\s*$/);
  if (quotedHead) {
    return quotedHead[1];
  }

  return undefined;
}

function parseNumericToken(token: string): number | string {
  const normalized = token.replace(/,/g, "");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : token;
}

function scoreConfidence(
  raw: string,
  field: string,
  operator: RuleOperator,
  value: unknown
): ParsedNlRule["confidence"] {
  let score = 0;
  if (LEADING_PREFIX.test(raw)) {
    score += 1;
  }
  if (field.length > 1) {
    score += 1;
  }
  if (operator === "exists" || value !== undefined) {
    score += 1;
  }
  if (score >= 3) {
    return "high";
  }
  if (score >= 2) {
    return "medium";
  }
  return "low";
}

function isStopWord(token: string): boolean {
  return ["when", "if", "is", "are", "be", "to", "on", "at", "in", "me", "alert", "notify"].includes(token.toLowerCase());
}

function formatYamlValue(value: unknown): string {
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(String(value));
}