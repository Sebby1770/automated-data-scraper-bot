import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { DataItem, DataRecord, HtmlFieldConfig, HtmlSourceConfig } from "../types.js";
import { stableHash } from "../utils/hash.js";
import { fetchText } from "../utils/http.js";
import { compactText, getPath, toNumber } from "../utils/object.js";
import type { SourceAdapter, SourceRuntimeOptions } from "./types.js";

export class HtmlSourceAdapter implements SourceAdapter {
  readonly config: HtmlSourceConfig;

  constructor(config: HtmlSourceConfig, private readonly options: SourceRuntimeOptions) {
    this.config = config;
  }

  async fetchItems(): Promise<DataItem[]> {
    const html = await fetchText(this.config.url, this.options.userAgent, this.options.requestTimeoutMs);
    const $ = cheerio.load(html);
    const observedAt = new Date().toISOString();
    const items: DataItem[] = [];

    $(this.config.itemSelector).each((index, element) => {
      const data = Object.fromEntries(
        Object.entries(this.config.fields).map(([name, field]) => [name, extractField($, element, field, this.baseUrl)])
      );

      const title = String(data.title ?? `${this.config.label ?? this.config.id} item ${index + 1}`);
      const url = typeof data.url === "string" ? data.url : undefined;
      const idValues = (this.config.idFields ?? ["title", "url"]).map((field) => getPath(data, field));
      const id = stableHash({
        source: this.config.id,
        idValues: idValues.some(Boolean) ? idValues : data
      });

      items.push({
        id,
        sourceId: this.config.id,
        sourceLabel: this.config.label ?? this.config.id,
        title,
        url,
        observedAt,
        data
      });
    });

    return items;
  }

  private get baseUrl(): string {
    return this.config.baseUrl ?? this.config.url;
  }
}

function extractField($: CheerioAPI, element: AnyNode, field: HtmlFieldConfig, baseUrl: string): unknown {
  const target = $(element).find(field.selector).first();
  const raw = field.attr ? target.attr(field.attr) : target.text();
  return applyTransform(raw ?? "", field.transform ?? "text", baseUrl);
}

function applyTransform(value: string, transform: HtmlFieldConfig["transform"], baseUrl: string): unknown {
  const text = compactText(value);

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

export function makeHtmlItem(source: HtmlSourceConfig, data: DataRecord): DataItem {
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
