import { describe, expect, it, vi, afterEach } from "vitest";
import { parseNlRule } from "../src/nl-rules.js";
import { resetPolitenessForTests } from "../src/politeness.js";
import { isPathAllowed, parseRobotsTxt } from "../src/robots.js";
import { evaluateCondition } from "../src/rules.js";
import { runOnce } from "../src/runner.js";
import { CsvSourceAdapter } from "../src/sources/csv.js";
import { HtmlSourceAdapter } from "../src/sources/html.js";
import { createMemoryTextSnapshotStore } from "../src/state/text-snapshots.js";
import { MemoryStateStore } from "../src/state/memory.js";
import { createMemoryPriceHistoryStore } from "../src/state/price-history.js";
import type { BotConfig, DataItem } from "../src/types.js";
import { fetchTextConditional, resetConditionalCacheForTests } from "../src/utils/http.js";

const item = (title: string): DataItem => ({
  id: "item-1",
  sourceId: "shop",
  sourceLabel: "Shop",
  title,
  observedAt: "2026-11-04T00:00:00.000Z",
  data: { title }
});

describe("robots.txt", () => {
  it("lets the longest matching rule win and prefers allow on a tie", () => {
    const rules = parseRobotsTxt(`
      User-agent: *
      Disallow: /private
      Allow: /private/public
      Disallow: /exact$
      Allow: /exact$

      User-agent: AutomatedDataScraperBot
      Disallow: /secret
      Crawl-delay: 2
    `);

    expect(isPathAllowed(rules, "Mozilla", "/private/file")).toBe(false);
    expect(isPathAllowed(rules, "Mozilla", "/private/public/a")).toBe(true);
    expect(isPathAllowed(rules, "Mozilla", "/exact")).toBe(true);
    expect(isPathAllowed(rules, "Mozilla", "/open")).toBe(true);
    expect(isPathAllowed(rules, "AutomatedDataScraperBot/0.8", "/secret")).toBe(false);
    expect(isPathAllowed(rules, "AutomatedDataScraperBot/0.8", "/private/file")).toBe(true);
    expect(rules.groups.find((group) => group.agents.includes("automateddatascraperbot"))?.crawlDelayMs).toBe(2000);
  });
});

describe("conditional GET", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetConditionalCacheForTests();
  });

  it("reuses the cached body when the server returns 304", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("first", { status: 200, headers: { etag: "\"abc\"" } }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await fetchTextConditional("https://example.com/feed", "bot", 1000);
    const second = await fetchTextConditional("https://example.com/feed", "bot", 1000);

    expect(first).toEqual({ body: "first", notModified: false });
    expect(second).toEqual({ body: "first", notModified: true });
    const secondHeaders = new Headers(fetchMock.mock.calls[1][1].headers);
    expect(secondHeaders.get("if-none-match")).toBe("\"abc\"");
  });
});

describe("html pagination and regex fields", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetPolitenessForTests();
  });

  it("follows the next link and extracts a regex group", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/page-2")) {
          return new Response(`<article class="product"><a class="name" href="/b">Beta 12</a></article>`);
        }
        return new Response(`
          <article class="product"><a class="name" href="/a">Alpha 7</a></article>
          <a class="next" href="/page-2">Next</a>
        `);
      })
    );

    const adapter = new HtmlSourceAdapter(
      {
        id: "shop",
        type: "html",
        url: "https://example.com/page-1",
        itemSelector: ".product",
        pagination: { nextSelector: "a.next", maxPages: 2 },
        fields: {
          title: { selector: ".name" },
          code: { selector: ".name", transform: "regex", pattern: "(\\d+)", group: 1 }
        }
      },
      { userAgent: "bot", requestTimeoutMs: 1000 }
    );

    const items = await adapter.fetchItems();
    expect(items.map((entry) => entry.title)).toEqual(["Alpha 7", "Beta 12"]);
    expect(items.map((entry) => entry.data.code)).toEqual(["7", "12"]);
  });

  it("stops when robots.txt disallows the path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).endsWith("/robots.txt")) {
          return new Response("User-agent: *\nDisallow: /hidden\n");
        }
        return new Response("<p>secret</p>");
      })
    );

    const adapter = new HtmlSourceAdapter(
      {
        id: "hidden",
        type: "html",
        url: "https://example.com/hidden",
        itemSelector: "p",
        fields: { title: { selector: "p" } }
      },
      { userAgent: "bot", requestTimeoutMs: 1000, respectRobotsTxt: true }
    );

    await expect(adapter.fetchItems()).rejects.toThrow(/robots\.txt/);
  });
});

describe("csv source", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("turns header rows into items and parses numbers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("title,price\nMug,12.5\n", { status: 200 }))
    );
    const adapter = new CsvSourceAdapter(
      { id: "sheet", type: "csv", url: "https://example.com/items.csv", idFields: ["title"] },
      { userAgent: "bot", requestTimeoutMs: 1000 }
    );
    const items = await adapter.fetchItems();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Mug");
    expect(items[0].data.price).toBe(12.5);
  });
});

describe("changed rules", () => {
  it("stays quiet on the first observation and alerts when the text changes", () => {
    const snapshots = createMemoryTextSnapshotStore();
    const context = {
      getPreviousText: (sourceId: string, itemId: string, field: string) => snapshots.get(sourceId, itemId, field)
    };
    const condition = { field: "title", operator: "changed" as const };
    expect(evaluateCondition(item("Mug"), condition, context)).toBe(false);
    snapshots.record([item("Mug")], ["title"]);
    expect(evaluateCondition(item("Mug"), condition, context)).toBe(false);
    expect(evaluateCondition(item("Cup"), condition, context)).toBe(true);
  });

  it("parses a natural-language change rule", () => {
    const parsed = parseNlRule("alert when title changes");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.rule.operator).toBe("changed");
      expect(parsed.rule.field).toBe("title");
    }
  });

  it("records the baseline during a scrape and alerts on the next run", async () => {
    const snapshots = createMemoryTextSnapshotStore();
    const config: BotConfig = {
      settings: {
        runIntervalSeconds: 60,
        userAgent: "bot",
        requestTimeoutMs: 1000,
        maxConcurrency: 1,
        stateTtlDays: 1
      },
      sources: [
        {
          id: "sheet",
          type: "csv",
          url: "https://example.com/items.csv",
          idFields: ["sku"]
        }
      ],
      rules: [
        {
          name: "Title changed",
          source: "sheet",
          all: [{ field: "title", operator: "changed" }]
        }
      ],
      notifiers: [{ type: "console", enabled: false }]
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("sku,title\n1,Mug\n", { status: 200 }))
      .mockResolvedValueOnce(new Response("sku,title\n1,Cup\n", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await runOnce(config, {
      dryRun: true,
      includeAlerts: true,
      stateStore: new MemoryStateStore(),
      priceHistoryStore: createMemoryPriceHistoryStore(),
      textSnapshotStore: snapshots
    });
    const second = await runOnce(config, {
      dryRun: true,
      includeAlerts: true,
      stateStore: new MemoryStateStore(),
      priceHistoryStore: createMemoryPriceHistoryStore(),
      textSnapshotStore: snapshots
    });

    expect(first.alertCount).toBe(0);
    expect(second.alertCount).toBe(1);
    expect(second.alerts?.[0].title).toBe("Cup");
    expect(second.alerts?.[0].message).toContain('title: "Mug" → "Cup"');
    expect(second.alerts?.[0].changes).toEqual([{ field: "title", previous: "Mug", current: "Cup" }]);
    vi.unstubAllGlobals();
  });
});
