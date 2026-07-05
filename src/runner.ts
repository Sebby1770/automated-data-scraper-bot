import type { Alert, BotConfig, DataItem, PriceTrend, RunSummary, SourceHealth } from "./types.js";
import { detectAnomalies, pickPrimaryAnomaly } from "./anomaly.js";
import { sendDigest } from "./digest.js";
import { createNotifiers } from "./notifiers/index.js";
import type { Notifier } from "./notifiers/types.js";
import { evaluateRules } from "./rules.js";
import { createSourceAdapter } from "./sources/index.js";
import { createStateStore, type StateStore } from "./state/index.js";
import {
  createPriceHistoryStore,
  type PriceHistoryStore,
  type PriceSnapshot
} from "./state/price-history.js";

export interface RunOptions {
  dryRun?: boolean;
  includeAlerts?: boolean;
  stateStore?: StateStore;
  priceHistoryStore?: PriceHistoryStore;
  notifiers?: Notifier[];
}

export async function runOnce(config: BotConfig, options: RunOptions = {}): Promise<RunSummary> {
  const startedAt = new Date().toISOString();
  const state = options.stateStore ?? createStateStore(config.settings.stateTtlDays);
  const priceHistory = options.priceHistoryStore ?? createPriceHistoryStore();
  const notifiers = options.notifiers ?? createNotifiers(config.notifiers);
  const adapters = config.sources.map((source) =>
    createSourceAdapter(source, {
      userAgent: config.settings.userAgent,
      requestTimeoutMs: config.settings.requestTimeoutMs
    })
  );
  const errors: string[] = [];
  const digestMode = config.settings.digestMode === true;
  const trackedFields = config.settings.priceHistoryFields ?? ["price"];
  const anomalyThreshold = config.settings.anomalyThresholdPercent ?? 20;

  await state.prune?.();

  const sourceHealth: SourceHealth[] = [];
  const sourceResults = await mapLimit(adapters, config.settings.maxConcurrency, async (adapter) => {
    const lastFetchAt = new Date().toISOString();

    try {
      const fetchedItems = await adapter.fetchItems();
      sourceHealth.push({
        sourceId: adapter.config.id,
        sourceLabel: adapter.config.label ?? adapter.config.id,
        lastFetchAt,
        itemCount: fetchedItems.length
      });
      return fetchedItems;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${adapter.config.id}: ${message}`);
      sourceHealth.push({
        sourceId: adapter.config.id,
        sourceLabel: adapter.config.label ?? adapter.config.id,
        lastFetchAt,
        itemCount: 0,
        error: message
      });
      return [];
    }
  });

  const items = sourceResults.flat();
  const priceHistoryUpdates = await priceHistory.recordItems(items, trackedFields, startedAt);
  const matches = items.flatMap((item) => evaluateRules(item, config.rules));
  const alerts: Alert[] = [];

  for (const match of matches) {
    if (await state.has(match.alert.id)) {
      continue;
    }

    const enrichedAlert = enrichAlert(match.alert, match.alert.item, priceHistory, anomalyThreshold);
    alerts.push(enrichedAlert);

    if (!options.dryRun && !digestMode) {
      await notifyAll(notifiers, enrichedAlert, errors);
      await state.mark(enrichedAlert.id);
    }
  }

  if (!options.dryRun && digestMode && alerts.length > 0) {
    await sendDigest(notifiers, alerts, errors);
    for (const alert of alerts) {
      await state.mark(alert.id);
    }
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    sourceCount: config.sources.length,
    itemCount: items.length,
    matchedCount: matches.length,
    alertCount: alerts.length,
    errors,
    sourceHealth,
    digestMode,
    priceHistory: {
      updated: priceHistoryUpdates.updated,
      entries: priceHistoryUpdates.entries
    },
    ...(options.includeAlerts ? { alerts } : {})
  };
}

export async function watch(config: BotConfig): Promise<void> {
  const run = async () => {
    const summary = await runOnce(config);
    logSummary(summary);
  };

  await run();
  setInterval(() => {
    void run().catch((error) => {
      console.error(error);
    });
  }, config.settings.runIntervalSeconds * 1000);
}

export function logSummary(summary: RunSummary): void {
  const errorSuffix = summary.errors.length > 0 ? `, errors=${summary.errors.length}` : "";
  const digestSuffix = summary.digestMode ? ", digest=true" : "";
  console.log(
    `Scrape complete: sources=${summary.sourceCount}, items=${summary.itemCount}, matches=${summary.matchedCount}, alerts=${summary.alertCount}${digestSuffix}${errorSuffix}`
  );

  for (const error of summary.errors) {
    console.warn(`Source error: ${error}`);
  }
}

function enrichAlert(
  alert: Alert,
  item: DataItem,
  priceHistory: PriceHistoryStore,
  anomalyThreshold: number
): Alert {
  const historyByField = priceHistory.getItemHistory(item.sourceId, item.id);
  const anomaly = pickPrimaryAnomaly(detectAnomalies(item, historyByField, anomalyThreshold));
  const priceTrend = buildPriceTrend(historyByField);

  return {
    ...alert,
    ...(anomaly ? { anomaly } : {}),
    ...(priceTrend ? { priceHistory: priceTrend } : {})
  };
}

function buildPriceTrend(historyByField: Record<string, PriceSnapshot[]>): PriceTrend | undefined {
  const [field, history] =
    Object.entries(historyByField).find(([, points]) => points.length >= 2) ?? Object.entries(historyByField)[0] ?? [];

  if (!field || !history || history.length === 0) {
    return undefined;
  }

  const changePercent = computeChangePercent(history);
  return {
    field,
    history,
    changePercent,
    direction: directionFromChange(changePercent)
  };
}

export function computeChangePercent(history: PriceSnapshot[]): number | undefined {
  if (history.length < 2) {
    return undefined;
  }

  const first = history[0].value;
  const last = history[history.length - 1].value;
  if (first === 0) {
    return undefined;
  }

  return Math.round((((last - first) / first) * 100) * 100) / 100;
}

export function directionFromChange(changePercent: number | undefined): PriceTrend["direction"] {
  if (changePercent === undefined) {
    return "flat";
  }
  if (changePercent > 0.5) {
    return "up";
  }
  if (changePercent < -0.5) {
    return "down";
  }
  return "flat";
}

async function notifyAll(notifiers: Notifier[], alert: Alert, errors: string[]): Promise<void> {
  for (const notifier of notifiers) {
    try {
      await notifier.send(alert);
    } catch (error) {
      errors.push(`${notifier.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function mapLimit<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;

  async function next(): Promise<void> {
    const index = cursor;
    cursor += 1;

    if (index >= items.length) {
      return;
    }

    results[index] = await worker(items[index]);
    await next();
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => next());
  await Promise.all(workers);
  return results;
}

export function summarizeItems(items: DataItem[]): string {
  return items.map((item) => `${item.sourceId}: ${item.title}`).join("\n");
}