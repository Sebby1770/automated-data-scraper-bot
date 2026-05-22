import { afterEach, describe, expect, it, vi } from "vitest";
import { HtmlSourceAdapter } from "../src/sources/html.js";
import type { HtmlSourceConfig } from "../src/types.js";

describe("HtmlSourceAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts configured fields and transforms prices and URLs", async () => {
    const html = `
      <article class="product">
        <a class="name" href="/shoe">Running Shoe</a>
        <span class="price">$49.95</span>
      </article>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(html, { status: 200 }))
    );

    const config: HtmlSourceConfig = {
      id: "retail",
      type: "html",
      url: "https://example.com/products",
      itemSelector: ".product",
      fields: {
        title: { selector: ".name" },
        url: { selector: ".name", attr: "href", transform: "absolute_url" },
        price: { selector: ".price", transform: "price" }
      }
    };

    const adapter = new HtmlSourceAdapter(config, {
      userAgent: "test",
      requestTimeoutMs: 1000
    });

    const items = await adapter.fetchItems();

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Running Shoe");
    expect(items[0].url).toBe("https://example.com/shoe");
    expect(items[0].data.price).toBe(49.95);
  });
});
