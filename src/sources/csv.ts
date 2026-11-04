import { parse } from "csv-parse/sync";
import type { CsvSourceConfig, DataItem, DataRecord } from "../types.js";
import { stableHash } from "../utils/hash.js";
import { getPath, toNumber } from "../utils/object.js";
import { fetchSourceText } from "./fetch.js";
import type { SourceAdapter, SourceRuntimeOptions } from "./types.js";

export class CsvSourceAdapter implements SourceAdapter {
  readonly config: CsvSourceConfig;

  constructor(config: CsvSourceConfig, private readonly options: SourceRuntimeOptions) {
    this.config = config;
  }

  async fetchItems(): Promise<DataItem[]> {
    const csv = await fetchSourceText(this.config.url, this.options);
    const rows = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as Array<Record<string, string>>;
    const observedAt = new Date().toISOString();

    return rows.map((row, index) => {
      const data: DataRecord = { ...row };
      for (const [key, value] of Object.entries(data)) {
        const numeric = toNumber(value);
        if (numeric !== undefined && String(value).trim() !== "") {
          data[key] = numeric;
        }
      }
      return makeCsvItem(this.config, data, observedAt, index);
    });
  }
}

export function makeCsvItem(source: CsvSourceConfig, data: DataRecord, observedAt = new Date().toISOString(), index = 0): DataItem {
  const title = String(data.title ?? data.name ?? Object.values(data)[0] ?? `${source.label ?? source.id} row ${index + 1}`);
  const url = typeof data.url === "string" ? data.url : undefined;
  const idValues = (source.idFields ?? ["title", "name", "url"]).map((field) => getPath(data, field));
  return {
    id: stableHash({
      source: source.id,
      idValues: idValues.some(Boolean) ? idValues : data
    }),
    sourceId: source.id,
    sourceLabel: source.label ?? source.id,
    title,
    url,
    observedAt,
    data
  };
}
