import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { DataItem } from "../types.js";
import { toNumber } from "../utils/object.js";

export const MAX_PRICE_HISTORY_POINTS = 30;

export interface PriceSnapshot {
  value: number;
  timestamp: string;
}

export interface PriceHistoryEntry {
  sourceId: string;
  itemId: string;
  field: string;
  history: PriceSnapshot[];
}

type PriceHistorySnapshot = Record<string, PriceSnapshot[]>;

export interface PriceHistoryStore {
  recordItems(items: DataItem[], fields: string[], observedAt?: string): Promise<PriceHistoryUpdates>;
  getHistory(sourceId: string, itemId: string, field: string): PriceSnapshot[];
  getItemHistory(sourceId: string, itemId: string): Record<string, PriceSnapshot[]>;
  snapshot(): PriceHistoryEntry[];
}

export interface PriceHistoryUpdates {
  updated: number;
  entries: PriceHistoryEntry[];
}

export function createPriceHistoryStore(filePath = process.env.PRICE_HISTORY_FILE ?? "data/price-history.json"): PriceHistoryStore {
  return new FilePriceHistoryStore(filePath);
}

export function extractNumericFields(item: DataItem, trackedFields: string[]): Array<{ field: string; value: number }> {
  const results: Array<{ field: string; value: number }> = [];
  const seen = new Set<string>();

  for (const field of trackedFields) {
    const value = readItemField(item, field);
    const numeric = toNumber(value);
    if (numeric !== undefined && !seen.has(field)) {
      seen.add(field);
      results.push({ field, value: numeric });
    }
  }

  for (const [field, value] of Object.entries(item.data)) {
    if (seen.has(field)) {
      continue;
    }
    const numeric = toNumber(value);
    if (numeric !== undefined && trackedFields.includes(field)) {
      seen.add(field);
      results.push({ field, value: numeric });
    }
  }

  return results;
}

export function readItemField(item: DataItem, field: string): unknown {
  if (field in item) {
    return (item as unknown as Record<string, unknown>)[field];
  }
  return item.data[field];
}

function historyKey(sourceId: string, itemId: string, field: string): string {
  return `${sourceId}::${itemId}::${field}`;
}

function parseHistoryKey(key: string): PriceHistoryEntry | undefined {
  const parts = key.split("::");
  if (parts.length !== 3) {
    return undefined;
  }

  const [sourceId, itemId, field] = parts;
  return { sourceId, itemId, field, history: [] };
}

class FilePriceHistoryStore implements PriceHistoryStore {
  private state: PriceHistorySnapshot | undefined;

  constructor(private readonly filePath: string) {}

  async recordItems(items: DataItem[], fields: string[], observedAt = new Date().toISOString()): Promise<PriceHistoryUpdates> {
    const state = this.load();
    const updatedEntries: PriceHistoryEntry[] = [];

    for (const item of items) {
      const numericFields = extractNumericFields(item, fields);
      for (const { field, value } of numericFields) {
        const key = historyKey(item.sourceId, item.id, field);
        const history = state[key] ?? [];
        const last = history[history.length - 1];

        if (last?.value === value && last.timestamp === observedAt) {
          continue;
        }

        const nextHistory = [...history, { value, timestamp: observedAt }].slice(-MAX_PRICE_HISTORY_POINTS);
        state[key] = nextHistory;
        updatedEntries.push({
          sourceId: item.sourceId,
          itemId: item.id,
          field,
          history: nextHistory
        });
      }
    }

    this.persist();
    return {
      updated: updatedEntries.length,
      entries: updatedEntries
    };
  }

  getHistory(sourceId: string, itemId: string, field: string): PriceSnapshot[] {
    const state = this.load();
    return [...(state[historyKey(sourceId, itemId, field)] ?? [])];
  }

  getItemHistory(sourceId: string, itemId: string): Record<string, PriceSnapshot[]> {
    const state = this.load();
    const prefix = `${sourceId}::${itemId}::`;
    const result: Record<string, PriceSnapshot[]> = {};

    for (const [key, history] of Object.entries(state)) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      const field = key.slice(prefix.length);
      result[field] = [...history];
    }

    return result;
  }

  snapshot(): PriceHistoryEntry[] {
    const state = this.load();
    return Object.entries(state).flatMap(([key, history]) => {
      const parsed = parseHistoryKey(key);
      if (!parsed) {
        return [];
      }
      return [{ ...parsed, history: [...history] }];
    });
  }

  private load(): PriceHistorySnapshot {
    if (this.state) {
      return this.state;
    }

    const absolutePath = resolve(process.cwd(), this.filePath);
    try {
      this.state = JSON.parse(readFileSync(absolutePath, "utf8")) as PriceHistorySnapshot;
    } catch {
      this.state = {};
    }

    return this.state;
  }

  private persist(): void {
    const absolutePath = resolve(process.cwd(), this.filePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, `${JSON.stringify(this.state ?? {}, null, 2)}\n`);
  }
}

class MemoryPriceHistoryStore implements PriceHistoryStore {
  private readonly state: PriceHistorySnapshot = {};

  async recordItems(items: DataItem[], fields: string[], observedAt = new Date().toISOString()): Promise<PriceHistoryUpdates> {
    const updatedEntries: PriceHistoryEntry[] = [];

    for (const item of items) {
      const numericFields = extractNumericFields(item, fields);
      for (const { field, value } of numericFields) {
        const key = historyKey(item.sourceId, item.id, field);
        const history = this.state[key] ?? [];
        const nextHistory = [...history, { value, timestamp: observedAt }].slice(-MAX_PRICE_HISTORY_POINTS);
        this.state[key] = nextHistory;
        updatedEntries.push({
          sourceId: item.sourceId,
          itemId: item.id,
          field,
          history: nextHistory
        });
      }
    }

    return {
      updated: updatedEntries.length,
      entries: updatedEntries
    };
  }

  getHistory(sourceId: string, itemId: string, field: string): PriceSnapshot[] {
    return [...(this.state[historyKey(sourceId, itemId, field)] ?? [])];
  }

  getItemHistory(sourceId: string, itemId: string): Record<string, PriceSnapshot[]> {
    const prefix = `${sourceId}::${itemId}::`;
    const result: Record<string, PriceSnapshot[]> = {};

    for (const [key, history] of Object.entries(this.state)) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      result[key.slice(prefix.length)] = [...history];
    }

    return result;
  }

  snapshot(): PriceHistoryEntry[] {
    return Object.entries(this.state).flatMap(([key, history]) => {
      const parsed = parseHistoryKey(key);
      if (!parsed) {
        return [];
      }
      return [{ ...parsed, history: [...history] }];
    });
  }
}

export function createMemoryPriceHistoryStore(): PriceHistoryStore {
  return new MemoryPriceHistoryStore();
}