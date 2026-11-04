import { XMLParser } from "fast-xml-parser";
import type { DataItem, SitemapSourceConfig } from "../types.js";
import { stableHash } from "../utils/hash.js";
import { compactText } from "../utils/object.js";
import { fetchSourceText } from "./fetch.js";
import type { SourceAdapter, SourceRuntimeOptions } from "./types.js";

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

export interface SitemapDocument {
  urls: SitemapEntry[];
  sitemaps: string[];
}

const MAX_URLS = 200;
const MAX_SITEMAPS = 8;

export class SitemapSourceAdapter implements SourceAdapter {
  readonly config: SitemapSourceConfig;

  constructor(config: SitemapSourceConfig, private readonly options: SourceRuntimeOptions) {
    this.config = config;
  }

  async fetchItems(): Promise<DataItem[]> {
    const first = parseSitemapDocument(await fetchSourceText(this.config.url, this.options));
    const entries = [...first.urls];
    if (entries.length === 0 && first.sitemaps.length > 0) {
      const childLimit = Math.min(this.config.maxSitemaps ?? 3, MAX_SITEMAPS);
      for (const child of first.sitemaps.slice(0, childLimit)) {
        if (!isHttpUrl(child)) {
          continue;
        }
        const nested = parseSitemapDocument(await fetchSourceText(child, this.options));
        entries.push(...nested.urls);
      }
    }
    return sitemapEntriesToItems(this.config, entries);
  }
}

export function parseSitemapDocument(xml: string): SitemapDocument {
  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true
  });
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const urlset = parsed.urlset as Record<string, unknown> | undefined;
  const index = parsed.sitemapindex as Record<string, unknown> | undefined;
  return {
    urls: asList(urlset?.url).flatMap((node) => {
      const loc = textOf(node.loc);
      if (!loc || !isHttpUrl(loc)) {
        return [];
      }
      const lastmod = textOf(node.lastmod);
      return [{ loc, lastmod }];
    }),
    sitemaps: asList(index?.sitemap).flatMap((node) => {
      const loc = textOf(node.loc);
      return loc ? [loc] : [];
    })
  };
}

export function sitemapTitle(loc: string): string {
  try {
    const url = new URL(loc);
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts.at(-1) ?? url.hostname;
    return compactText(decodeURIComponent(last).replace(/[-_]+/g, " "));
  } catch {
    return loc;
  }
}

export function sitemapEntriesToItems(source: SitemapSourceConfig, entries: SitemapEntry[], observedAt = new Date().toISOString()): DataItem[] {
  const include = compileFilter(source.include, "include");
  const exclude = compileFilter(source.exclude, "exclude");
  const limit = Math.min(Math.max(1, source.maxUrls ?? 40), MAX_URLS);
  const chosen = entries.filter((entry) => {
    if (include && !include.test(entry.loc)) {
      return false;
    }
    if (exclude && exclude.test(entry.loc)) {
      return false;
    }
    return true;
  }).slice(0, limit);

  return chosen.map((entry) => {
    const title = sitemapTitle(entry.loc);
    return {
      id: stableHash({ source: source.id, loc: entry.loc }),
      sourceId: source.id,
      sourceLabel: source.label ?? source.id,
      title,
      url: entry.loc,
      observedAt,
      data: {
        loc: entry.loc,
        title,
        lastmod: entry.lastmod
      }
    };
  });
}

function compileFilter(pattern: string | undefined, label: string): RegExp | undefined {
  if (!pattern) {
    return undefined;
  }
  try {
    return new RegExp(pattern, "i");
  } catch {
    throw new Error(`sitemap ${label} is not a valid regular expression`);
  }
}

function asList(value: unknown): Array<Record<string, unknown>> {
  if (!value) {
    return [];
  }
  const list = Array.isArray(value) ? value : [value];
  return list.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
}

function textOf(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (value && typeof value === "object" && "#text" in value) {
    return textOf((value as { "#text"?: unknown })["#text"]);
  }
  return undefined;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
