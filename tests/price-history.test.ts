import { describe, expect, it } from "vitest";
import { createMemoryPriceHistoryStore } from "../src/state/price-history.js";
import type { DataItem } from "../src/types.js";

const item: DataItem = {
  id: "book-1",
  sourceId: "retail",
  sourceLabel: "Retail",
  title: "Travel guide",
  observedAt: "2026-07-05T00:00:00.000Z",
  data: { price: 19.99 }
};

describe("price history", () => {
  it("stores snapshots and caps history length", async () => {
    const store = createMemoryPriceHistoryStore();

    for (let index = 0; index < 35; index += 1) {
      await store.recordItems(
        [{ ...item, data: { price: index + 1 } }],
        ["price"],
        `2026-07-05T00:00:${String(index).padStart(2, "0")}.000Z`
      );
    }

    const history = store.getHistory("retail", "book-1", "price");
    expect(history).toHaveLength(30);
    expect(history[0]?.value).toBe(6);
    expect(history.at(-1)?.value).toBe(35);
  });
});