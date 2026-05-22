import type { DataItem, SourceConfig } from "../types.js";

export interface SourceRuntimeOptions {
  userAgent: string;
  requestTimeoutMs: number;
}

export interface SourceAdapter {
  config: SourceConfig;
  fetchItems(): Promise<DataItem[]>;
}
