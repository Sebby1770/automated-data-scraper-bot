import type { SourceConfig } from "../types.js";
import { HtmlSourceAdapter } from "./html.js";
import { RssSourceAdapter } from "./rss.js";
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
  }
}
