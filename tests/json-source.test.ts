import { afterEach, describe, expect, it, vi } from "vitest";
import { JsonSourceAdapter } from "../src/sources/json.js";
import type { JsonSourceConfig } from "../src/types.js";

describe("JsonSourceAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts items using dot-notation paths and field mappings", async () => {
    const payload = {
      data: {
        items: [
          {
            id: "42",
            name: "Widget",
            pricing: { amount: "$19.99" },
            link: "https://example.com/widget"
          }
        ]
      }
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }))
    );

    const config: JsonSourceConfig = {
      id: "json-api",
      type: "json",
      url: "https://example.com/api/items",
      itemsPath: "data.items",
      idFields: ["id"],
      fields: {
        title: "name",
        price: "pricing.amount",
        url: "link"
      }
    };

    const adapter = new JsonSourceAdapter(config, {
      userAgent: "test",
      requestTimeoutMs: 1000
    });

    const items = await adapter.fetchItems();

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Widget");
    expect(items[0].url).toBe("https://example.com/widget");
    expect(items[0].data.price).toBe(19.99);
  });
});