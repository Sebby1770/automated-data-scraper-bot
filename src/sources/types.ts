import type { DataItem, SourceConfig } from "../types.js";

export interface SourceRuntimeOptions {
  userAgent: string;
  requestTimeoutMs: number;
  respectRobotsTxt?: boolean;
  minHostIntervalMs?: number;
  conditionalRequests?: boolean;
}

export interface SourceAdapter {
  config: SourceConfig;
  fetchItems(): Promise<DataItem[]>;
}
