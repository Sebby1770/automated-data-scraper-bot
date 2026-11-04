import { loadConfig } from "./config.js";
import { createSourceAdapter } from "./sources/index.js";
import type { DataItem, DataRecord } from "./types.js";

const PREVIEW_ITEM_LIMIT = 20;
const PREVIEW_TEXT_LIMIT = 240;

export interface PreviewItem {
  id: string;
  title: string;
  url: string;
  fields: Record<string, string>;
}

export interface SourcePreview {
  sourceId: string;
  sourceLabel: string;
  total: number;
  items: PreviewItem[];
}

/** Read-only fetch. Does not notify, snapshot, write price history, or record metrics. */
export async function previewDashboardSource(options: {
  configPath?: string;
  sourceId: string;
}): Promise<SourcePreview> {
  const sourceId = options.sourceId.trim();
  if (!sourceId) {
    throw new Error("Missing sourceId");
  }

  const config = loadConfig(options.configPath);
  const source = config.sources.find((entry) => entry.id === sourceId);
  if (!source) {
    throw new Error(`Unknown source id: ${sourceId}`);
  }

  const adapter = createSourceAdapter(source, {
    userAgent: config.settings.userAgent,
    requestTimeoutMs: config.settings.requestTimeoutMs,
    respectRobotsTxt: config.settings.respectRobotsTxt,
    minHostIntervalMs: config.settings.minHostIntervalMs,
    conditionalRequests: config.settings.conditionalRequests
  });
  const fetched = await adapter.fetchItems();

  return {
    sourceId: source.id,
    sourceLabel: source.label ?? source.id,
    total: fetched.length,
    items: toPreviewItems(fetched)
  };
}

export function toPreviewItems(items: DataItem[], limit = PREVIEW_ITEM_LIMIT): PreviewItem[] {
  return items.slice(0, limit).map((item) => ({
    id: truncateText(item.id),
    title: truncateText(item.title),
    url: truncateText(item.url ?? ""),
    fields: shortenFields(item.data)
  }));
}

export function truncateText(value: string, limit = PREVIEW_TEXT_LIMIT): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 1)}…`;
}

function shortenFields(data: DataRecord): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    const text = fieldText(value);
    if (text === undefined) {
      continue;
    }
    fields[truncateText(key, 80)] = truncateText(text);
  }
  return fields;
}

function fieldText(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null || value === undefined) {
    return undefined;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}
