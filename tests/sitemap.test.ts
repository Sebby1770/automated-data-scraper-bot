import { describe, expect, it } from "vitest";
import { parseSitemapDocument, sitemapEntriesToItems, sitemapTitle } from "../src/sources/sitemap.js";
import type { SitemapSourceConfig } from "../src/types.js";

const urlset = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/docs/planting-guide</loc><lastmod>2026-11-01</lastmod></url>
  <url><loc>https://example.com/shop/seeds</loc><lastmod>2026-10-02</lastmod></url>
  <url><loc>javascript:alert(1)</loc></url>
</urlset>`;

const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex>
  <sitemap><loc>https://example.com/maps/a.xml</loc></sitemap>
  <sitemap><loc>https://example.com/maps/b.xml</loc></sitemap>
</sitemapindex>`;

const source: SitemapSourceConfig = {
  id: "docs",
  type: "sitemap",
  url: "https://example.com/sitemap.xml",
  include: "/docs/",
  maxUrls: 10
};

describe("sitemap sources", () => {
  it("reads url entries and drops non-http locations", () => {
    const parsed = parseSitemapDocument(urlset);
    expect(parsed.urls).toEqual([
      { loc: "https://example.com/docs/planting-guide", lastmod: "2026-11-01" },
      { loc: "https://example.com/shop/seeds", lastmod: "2026-10-02" }
    ]);
    expect(parsed.sitemaps).toEqual([]);
  });

  it("reads a sitemap index", () => {
    expect(parseSitemapDocument(index).sitemaps).toEqual([
      "https://example.com/maps/a.xml",
      "https://example.com/maps/b.xml"
    ]);
  });

  it("filters with include and builds a stable item", () => {
    const items = sitemapEntriesToItems(source, parseSitemapDocument(urlset).urls, "2026-11-04T00:00:00.000Z");
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("planting guide");
    expect(items[0].url).toBe("https://example.com/docs/planting-guide");
    expect(items[0].data.lastmod).toBe("2026-11-01");
    expect(sitemapTitle("https://example.com/")).toBe("example.com");
  });

  it("rejects a broken include pattern", () => {
    expect(() => sitemapEntriesToItems({ ...source, include: "(" }, [{ loc: "https://example.com/docs/a" }])).toThrow(/include/);
  });
});
