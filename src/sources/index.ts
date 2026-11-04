import type { SourceConfig } from "../types.js";
import { CsvSourceAdapter } from "./csv.js";
import { HtmlSourceAdapter } from "./html.js";
import { JsonSourceAdapter } from "./json.js";
import { RssSourceAdapter } from "./rss.js";
import { SitemapSourceAdapter } from "./sitemap.js";
import { StooqSourceAdapter } from "./stooq.js";
import type { SourceAdapter, SourceRuntimeOptions } from "./types.js";

export function createSourceAdapter(config: SourceConfig, options: SourceRuntimeOptions): SourceAdapter {
  switch (config.type) {
    case "html":
      return new HtmlSourceAdapter(config, options);
    case "rss":
      return new RssSourceAdapter(config, options);
    case "stooq":
      return new StooqSourceAdapter(config, options);
    case "json":
      return new JsonSourceAdapter(config, options);
    case "csv":
      return new CsvSourceAdapter(config, options);
    case "sitemap":
      return new SitemapSourceAdapter(config, options);
  }
}
