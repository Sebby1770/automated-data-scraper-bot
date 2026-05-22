import { XMLParser } from "fast-xml-parser";
import type { DataItem, RssSourceConfig } from "../types.js";
import { stableHash } from "../utils/hash.js";
import { fetchText } from "../utils/http.js";
import { compactText } from "../utils/object.js";
import type { SourceAdapter, SourceRuntimeOptions } from "./types.js";

interface RssEntry {
  title?: string;
  link?: string;
  guid?: string | { "#text"?: string };
  description?: string;
  pubDate?: string;
  category?: string | string[];
}

export class RssSourceAdapter implements SourceAdapter {
  readonly config: RssSourceConfig;

  constructor(config: RssSourceConfig, private readonly options: SourceRuntimeOptions) {
    this.config = config;
  }

  async fetchItems(): Promise<DataItem[]> {
    const xml = await fetchText(this.config.url, this.options.userAgent, this.options.requestTimeoutMs);
    const parser = new XMLParser({
      ignoreAttributes: false,
      trimValues: true
    });
    const parsed = parser.parse(xml) as Record<string, unknown>;
    const entries = normalizeEntries(parsed);
    const observedAt = new Date().toISOString();

    return entries.map((entry) => {
      const guid = typeof entry.guid === "object" ? entry.guid["#text"] : entry.guid;
      const title = compactText(entry.title ?? "RSS item");
      const url = entry.link;
      const summary = stripHtml(entry.description ?? "");
      const id = stableHash({
        source: this.config.id,
        guid: guid ?? url ?? title
      });

      return {
        id,
        sourceId: this.config.id,
        sourceLabel: this.config.label ?? this.config.id,
        title,
        url,
        observedAt,
        data: {
          title,
          url,
          summary,
          publishedAt: entry.pubDate,
          category: entry.category
        }
      };
    });
  }
}

function normalizeEntries(parsed: Record<string, unknown>): RssEntry[] {
  const rss = parsed.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  const rssItems = channel?.item;
  const feed = parsed.feed as Record<string, unknown> | undefined;
  const atomItems = feed?.entry;
  const items = rssItems ?? atomItems ?? [];
  return Array.isArray(items) ? (items as RssEntry[]) : [items as RssEntry];
}

function stripHtml(value: string): string {
  return compactText(value.replace(/<[^>]*>/g, " "));
}
