import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { DataItem, DataRecord, HtmlFieldConfig, HtmlSourceConfig } from "../types.js";
import { stableHash } from "../utils/hash.js";
import { compactText, getPath, toNumber } from "../utils/object.js";
import { fetchSourceText } from "./fetch.js";
import type { SourceAdapter, SourceRuntimeOptions } from "./types.js";

export class HtmlSourceAdapter implements SourceAdapter {
  readonly config: HtmlSourceConfig;

  constructor(config: HtmlSourceConfig, private readonly options: SourceRuntimeOptions) {
    this.config = config;
  }

  async fetchItems(): Promise<DataItem[]> {
    const maxPages = Math.min(10, Math.max(1, this.config.pagination?.maxPages ?? 1));
    const seenPages = new Set<string>();
    const seenItems = new Set<string>();
    const items: DataItem[] = [];
    let pageUrl: string | undefined = this.config.url;

    while (pageUrl && seenPages.size < maxPages && !seenPages.has(pageUrl)) {
      seenPages.add(pageUrl);
      const html = await fetchSourceText(pageUrl, this.options);
      const page = extractPage(html, this.config, pageUrl);
      for (const item of page.items) {
        if (seenItems.has(item.id)) {
          continue;
        }
        seenItems.add(item.id);
        items.push(item);
      }
      pageUrl = this.config.pagination?.nextSelector ? page.nextUrl : undefined;
    }

    return items;
  }
}

function extractPage(html: string, source: HtmlSourceConfig, pageUrl: string): { items: DataItem[]; nextUrl?: string } {
  const $ = cheerio.load(html);
  const observedAt = new Date().toISOString();
  const baseUrl = source.baseUrl ?? pageUrl;
  const items: DataItem[] = [];

  $(source.itemSelector).each((index, element) => {
    const data = Object.fromEntries(
      Object.entries(source.fields).map(([name, field]) => [name, extractField($, element, field, baseUrl)])
    );
    items.push(makeHtmlItem(source, data, observedAt, index));
  });

  const nextHref = source.pagination?.nextSelector ? $(source.pagination.nextSelector).first().attr("href") : undefined;
  return {
    items,
    nextUrl: nextHref ? absolutize(nextHref, pageUrl) : undefined
  };
}

function extractField($: CheerioAPI, element: AnyNode, field: HtmlFieldConfig, baseUrl: string): unknown {
  const target = $(element).find(field.selector).first();
  const raw = field.attr ? target.attr(field.attr) : target.text();
  return applyTransform(raw ?? "", field, baseUrl);
}

function applyTransform(value: string, field: HtmlFieldConfig, baseUrl: string): unknown {
  const text = compactText(value);
  const transform = field.transform ?? "text";

  switch (transform) {
    case "number":
    case "price":
    case "percentage":
      return toNumber(text);
    case "absolute_url":
      return absolutize(text, baseUrl);
    case "lower":
      return text.toLowerCase();
    case "upper":
      return text.toUpperCase();
    case "regex": {
      if (!field.pattern) {
        throw new Error("regex transform requires a pattern");
      }
      let expression: RegExp;
      try {
        expression = new RegExp(field.pattern, "i");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid regex /${field.pattern}/: ${message}`);
      }
      const match = text.match(expression);
      return match?.[field.group ?? 0] ?? "";
    }
    case "text":
    default:
      return text;
  }
}

function absolutize(value: string, baseUrl: string): string {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

export function makeHtmlItem(source: HtmlSourceConfig, data: DataRecord, observedAt = new Date().toISOString(), index = 0): DataItem {
  const title = String(data.title ?? `${source.label ?? source.id} item ${index + 1}`);
  const url = typeof data.url === "string" ? data.url : undefined;
  const idValues = (source.idFields ?? ["title", "url"]).map((field) => getPath(data, field));
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
