import { parse } from "csv-parse/sync";
import type { DataItem, StooqSourceConfig } from "../types.js";
import { stableHash } from "../utils/hash.js";
import { fetchText } from "../utils/http.js";
import { toNumber } from "../utils/object.js";
import type { SourceAdapter, SourceRuntimeOptions } from "./types.js";

interface StooqRow {
  Symbol: string;
  Date: string;
  Time: string;
  Open: string;
  High: string;
  Low: string;
  Close: string;
  Volume: string;
  Name: string;
}

export class StooqSourceAdapter implements SourceAdapter {
  readonly config: StooqSourceConfig;

  constructor(config: StooqSourceConfig, private readonly options: SourceRuntimeOptions) {
    this.config = config;
  }

  async fetchItems(): Promise<DataItem[]> {
    const symbol = this.config.symbol.toLowerCase();
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcvn&h&e=csv`;
    const csv = await fetchText(url, this.options.userAgent, this.options.requestTimeoutMs);
    const rows = parse(csv, {
      columns: true,
      skip_empty_lines: true
    }) as StooqRow[];

    const row = rows[0];
    if (!row || row.Close === "N/D") {
      return [];
    }

    const price = toNumber(row.Close);
    const observedAt = new Date().toISOString();
    const title = `${row.Symbol} ${price ?? row.Close}`;

    return [
      {
        id: stableHash({
          source: this.config.id,
          symbol: row.Symbol,
          date: row.Date,
          time: row.Time,
          close: row.Close
        }),
        sourceId: this.config.id,
        sourceLabel: this.config.label ?? this.config.id,
        title,
        observedAt,
        data: {
          symbol: row.Symbol,
          name: row.Name,
          price,
          open: toNumber(row.Open),
          high: toNumber(row.High),
          low: toNumber(row.Low),
          close: price,
          volume: toNumber(row.Volume),
          quoteDate: row.Date,
          quoteTime: row.Time,
          provider: "stooq"
        }
      }
    ];
  }
}
