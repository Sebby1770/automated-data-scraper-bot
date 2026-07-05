import type { DataItem, DataRecord, JsonSourceConfig } from "../types.js";
import { stableHash } from "../utils/hash.js";
import { fetchJson } from "../utils/http.js";
import { compactText, getPath, toNumber } from "../utils/object.js";
import type { SourceAdapter, SourceRuntimeOptions } from "./types.js";

export class JsonSourceAdapter implements SourceAdapter {
  readonly config: JsonSourceConfig;

  constructor(config: JsonSourceConfig, private readonly options: SourceRuntimeOptions) {
    this.config = config;
  }

  async fetchItems(): Promise<DataItem[]> {
    const payload = await fetchJson(this.config.url, this.options.userAgent, this.options.requestTimeoutMs);
    const rawItems = resolveItems(payload, this.config.itemsPath);
    const observedAt = new Date().toISOString();

    return rawItems.map((rawItem, index) => {
      const data = Object.fromEntries(
        Object.entries(this.config.fields).map(([name, path]) => [name, mapFieldValue(getPath(rawItem, path))])
      );

      const title = String(data.title ?? `${this.config.label ?? this.config.id} item ${index + 1}`);
      const url = typeof data.url === "string" ? data.url : undefined;
      const idValues = (this.config.idFields ?? ["title", "url"]).map((field) => getPath(data, field));
      const id = stableHash({
        source: this.config.id,
        idValues: idValues.some(Boolean) ? idValues : data
      });

      return {
        id,
        sourceId: this.config.id,
        sourceLabel: this.config.label ?? this.config.id,
        title,
        url,
        observedAt,
        data
      };
    });
  }
}

function resolveItems(payload: unknown, itemsPath?: string): unknown[] {
  const resolved = itemsPath ? getPath(payload, itemsPath) : payload;

  if (Array.isArray(resolved)) {
    return resolved;
  }

  if (resolved && typeof resolved === "object") {
    return [resolved];
  }

  return [];
}

function mapFieldValue(value: unknown): unknown {
  if (typeof value === "string") {
    const text = compactText(value);
    const numeric = toNumber(text);
    return numeric ?? text;
  }

  return value;
}

export function makeJsonItem(source: JsonSourceConfig, data: DataRecord): DataItem {
  return {
    id: stableHash({ source: source.id, data }),
    sourceId: source.id,
    sourceLabel: source.label ?? source.id,
    title: String(data.title ?? source.label ?? source.id),
    url: typeof data.url === "string" ? data.url : undefined,
    observedAt: new Date().toISOString(),
    data
  };
}