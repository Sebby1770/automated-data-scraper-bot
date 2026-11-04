import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DataItem } from "../types.js";

export interface TextSnapshotStore {
  get(sourceId: string, itemId: string, field: string): string | undefined;
  record(items: DataItem[], fields: string[]): void;
}

export function createMemoryTextSnapshotStore(seed: Record<string, string> = {}): TextSnapshotStore {
  const values = new Map(Object.entries(seed));
  return {
    get(sourceId, itemId, field) {
      return values.get(snapshotKey(sourceId, itemId, field));
    },
    record(items, fields) {
      writeSnapshots(values, items, fields);
    }
  };
}

export function createFileTextSnapshotStore(filePath = process.env.TEXT_SNAPSHOT_FILE ?? "data/text-snapshots.json"): TextSnapshotStore {
  const values = new Map(Object.entries(readSnapshotFile(filePath)));
  return {
    get(sourceId, itemId, field) {
      return values.get(snapshotKey(sourceId, itemId, field));
    },
    record(items, fields) {
      if (fields.length === 0) {
        return;
      }
      writeSnapshots(values, items, fields);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, JSON.stringify(Object.fromEntries(values), null, 2));
    }
  };
}

function writeSnapshots(values: Map<string, string>, items: DataItem[], fields: string[]): void {
  for (const item of items) {
    for (const field of fields) {
      const value = item.data[field];
      if (value === undefined || value === null) {
        continue;
      }
      values.set(snapshotKey(item.sourceId, item.id, field), String(value));
    }
  }
}

function readSnapshotFile(filePath: string): Record<string, string> {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)]));
  } catch {
    return {};
  }
}

function snapshotKey(sourceId: string, itemId: string, field: string): string {
  return `${sourceId}\u0000${itemId}\u0000${field}`;
}
