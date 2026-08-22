export type DataRecord = Record<string, unknown>;

export type SourceKind = "html" | "rss" | "stooq" | "json";

export interface QuietHoursSettings {
  start: string;
  end: string;
  timezone?: "local" | string;
}

export interface BotSettings {
  runIntervalSeconds: number;
  userAgent: string;
  requestTimeoutMs: number;
  maxConcurrency: number;
  stateTtlDays: number;
  digestMode?: boolean;
  priceHistoryFields?: string[];
  anomalyThresholdPercent?: number;
  quietHours?: QuietHoursSettings;
  alertCooldownMinutes?: number;
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
  | "exists"
  | "changed_by"
  | "changed_pct"
  | "increased"
  | "decreased"
  | "between"
  | "starts_with"
  | "ends_with"
  | "trend_up"
  | "trend_down"
  | "above_avg_pct"
  | "below_avg_pct"
  | "min_of_window"
  | "max_of_window";

export type AlertSeverity = "info" | "warning" | "critical";

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value?: unknown;
  /** History window (number of observations) for windowed operators. Default 5. */
  window?: number;
}

export interface RuleConfig {
  name: string;
  source: string;
  all?: RuleCondition[];
  any?: RuleCondition[];
  message?: string;
  severity?: AlertSeverity;
  cooldownMinutes?: number;
  /** Notifier ids to deliver this rule's alerts to. Default: all notifiers. */
  notify?: string[];
}

export interface NotifierRouting {
  /** Stable id used by rule-level routing (`notify`). Defaults to the notifier type. */
  id?: string;
  /** Only deliver alerts at or above this severity. */
  minSeverity?: AlertSeverity;
}

export type NotifierConfig =
  | (NotifierRouting & {
      type: "console";
      enabled?: boolean;
    })
  | (NotifierRouting & {
      type: "discord";
      enabled?: boolean;
      webhookUrlEnv?: string;
    })
  | (NotifierRouting & {
      type: "telegram";
      enabled?: boolean;
      botTokenEnv?: string;
      chatIdEnv?: string;
    })
  | (NotifierRouting & {
      type: "slack";
      enabled?: boolean;
      webhookUrlEnv?: string;
    })
  | (NotifierRouting & {
      type: "webhook";
      enabled?: boolean;
      webhookUrlEnv?: string;
    });

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
  severity?: AlertSeverity;
  anomaly?: AlertAnomaly;
  priceHistory?: PriceTrend;
  /** True when the alert matched but delivery was suppressed by an active snooze. */
  snoozed?: boolean;
  snoozedUntil?: string;
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
  snoozedCount?: number;
  errors: string[];
  sourceHealth?: SourceHealth[];
  alerts?: Alert[];
  digestMode?: boolean;
  priceHistory?: PriceHistorySummary;
  quietHoursActive?: boolean;
  notificationsSuppressed?: boolean;
}
