export type DataRecord = Record<string, unknown>;

export type SourceKind = "html" | "rss" | "stooq" | "json";

export interface BotSettings {
  runIntervalSeconds: number;
  userAgent: string;
  requestTimeoutMs: number;
  maxConcurrency: number;
  stateTtlDays: number;
  digestMode?: boolean;
  priceHistoryFields?: string[];
  anomalyThresholdPercent?: number;
}

export interface BaseSourceConfig {
  id: string;
  type: SourceKind;
  label?: string;
}

export interface HtmlFieldConfig {
  selector: string;
  attr?: string;
  transform?: "text" | "number" | "price" | "percentage" | "absolute_url" | "lower" | "upper";
}

export interface HtmlSourceConfig extends BaseSourceConfig {
  type: "html";
  url: string;
  itemSelector: string;
  baseUrl?: string;
  idFields?: string[];
  fields: Record<string, HtmlFieldConfig>;
}

export interface RssSourceConfig extends BaseSourceConfig {
  type: "rss";
  url: string;
}

export interface StooqSourceConfig extends BaseSourceConfig {
  type: "stooq";
  symbol: string;
}

export interface JsonSourceConfig extends BaseSourceConfig {
  type: "json";
  url: string;
  itemsPath?: string;
  idFields?: string[];
  fields: Record<string, string>;
}

export type SourceConfig = HtmlSourceConfig | RssSourceConfig | StooqSourceConfig | JsonSourceConfig;

export type RuleOperator =
  | "<"
  | "<="
  | ">"
  | ">="
  | "=="
  | "!="
  | "contains"
  | "not_contains"
  | "regex"
  | "exists";

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value?: unknown;
}

export interface RuleConfig {
  name: string;
  source: string;
  all?: RuleCondition[];
  any?: RuleCondition[];
  message?: string;
}

export type NotifierConfig =
  | {
      type: "console";
      enabled?: boolean;
    }
  | {
      type: "discord";
      enabled?: boolean;
      webhookUrlEnv?: string;
    }
  | {
      type: "telegram";
      enabled?: boolean;
      botTokenEnv?: string;
      chatIdEnv?: string;
    }
  | {
      type: "slack";
      enabled?: boolean;
      webhookUrlEnv?: string;
    };

export interface BotConfig {
  settings: BotSettings;
  sources: SourceConfig[];
  rules: RuleConfig[];
  notifiers: NotifierConfig[];
}

export interface DataItem {
  id: string;
  sourceId: string;
  sourceLabel: string;
  title: string;
  url?: string;
  observedAt: string;
  data: DataRecord;
}

export interface PriceTrend {
  field: string;
  history: Array<{ value: number; timestamp: string }>;
  changePercent?: number;
  direction?: "up" | "down" | "flat";
}

export interface AlertAnomaly {
  field: string;
  current: number;
  average: number;
  deviationPercent: number;
  explanation: string;
}

export interface Alert {
  id: string;
  ruleName: string;
  sourceId: string;
  sourceLabel: string;
  title: string;
  url?: string;
  message: string;
  item: DataItem;
  matchedAt: string;
  anomaly?: AlertAnomaly;
  priceHistory?: PriceTrend;
}

export interface SourceHealth {
  sourceId: string;
  sourceLabel: string;
  lastFetchAt: string;
  itemCount: number;
  error?: string;
}

export interface PriceHistorySummary {
  updated: number;
  entries: Array<{
    sourceId: string;
    itemId: string;
    field: string;
    history: Array<{ value: number; timestamp: string }>;
  }>;
}

export interface RunSummary {
  startedAt: string;
  finishedAt: string;
  sourceCount: number;
  itemCount: number;
  matchedCount: number;
  alertCount: number;
  errors: string[];
  sourceHealth?: SourceHealth[];
  alerts?: Alert[];
  digestMode?: boolean;
  priceHistory?: PriceHistorySummary;
}
