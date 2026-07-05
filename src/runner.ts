import type { Alert, BotConfig, DataItem, RunSummary, SourceHealth } from "./types.js";
import { createNotifiers } from "./notifiers/index.js";
import type { Notifier } from "./notifiers/types.js";
import { evaluateRules } from "./rules.js";
import { createSourceAdapter } from "./sources/index.js";
import { createStateStore, type StateStore } from "./state/index.js";

export interface RunOptions {
  dryRun?: boolean;
  includeAlerts?: boolean;
  stateStore?: StateStore;
  notifiers?: Notifier[];
}

export async function runOnce(config: BotConfig, options: RunOptions = {}): Promise<RunSummary> {
  const startedAt = new Date().toISOString();
  const state = options.stateStore ?? createStateStore(config.settings.stateTtlDays);
  const notifiers = options.notifiers ?? createNotifiers(config.notifiers);
  const adapters = config.sources.map((source) =>
    createSourceAdapter(source, {
      userAgent: config.settings.userAgent,
      requestTimeoutMs: config.settings.requestTimeoutMs
    })
  );
  const errors: string[] = [];

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
  const matches = items.flatMap((item) => evaluateRules(item, config.rules));
  const alerts: Alert[] = [];

  for (const match of matches) {
    if (await state.has(match.alert.id)) {
      continue;
    }

    alerts.push(match.alert);

    if (!options.dryRun) {
      await notifyAll(notifiers, match.alert, errors);
      await state.mark(match.alert.id);
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
  console.log(
    `Scrape complete: sources=${summary.sourceCount}, items=${summary.itemCount}, matches=${summary.matchedCount}, alerts=${summary.alertCount}${errorSuffix}`
  );

  for (const error of summary.errors) {
    console.warn(`Source error: ${error}`);
  }
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
