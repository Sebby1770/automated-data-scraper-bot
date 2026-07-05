import { describe, expect, it } from "vitest";
import { evaluateCondition } from "../src/rules.js";
import type { DataItem } from "../src/types.js";

const item: DataItem = {
  id: "item-1",
  sourceId: "stock",
  sourceLabel: "Stock feed",
  title: "TSLA 170",
  observedAt: "2026-05-22T00:00:00.000Z",
  data: {
    price: 170
  }
};

const context = {
  getHistory: () => [
    { value: 180, timestamp: "2026-05-21T00:00:00.000Z" },
    { value: 170, timestamp: "2026-05-22T00:00:00.000Z" }
  ]
};

describe("comparison rules", () => {
  it("matches increased when the current value is higher than the previous snapshot", () => {
    const risingItem = { ...item, data: { price: 185 } };
    const risingContext = {
      getHistory: () => [
        { value: 180, timestamp: "2026-05-21T00:00:00.000Z" },
        { value: 185, timestamp: "2026-05-22T00:00:00.000Z" }
      ]
    };

    expect(evaluateCondition(risingItem, { field: "price", operator: "increased" }, risingContext)).toBe(true);
    expect(evaluateCondition(item, { field: "price", operator: "increased" }, context)).toBe(false);
  });

  it("matches decreased when the current value is lower than the previous snapshot", () => {
    expect(evaluateCondition(item, { field: "price", operator: "decreased" }, context)).toBe(true);
  });

  it("matches changed_by against the absolute delta", () => {
    expect(evaluateCondition(item, { field: "price", operator: "changed_by", value: 5 }, context)).toBe(true);
    expect(evaluateCondition(item, { field: "price", operator: "changed_by", value: 20 }, context)).toBe(false);
  });

  it("matches changed_pct against the percentage delta", () => {
    expect(evaluateCondition(item, { field: "price", operator: "changed_pct", value: 5 }, context)).toBe(true);
    expect(evaluateCondition(item, { field: "price", operator: "changed_pct", value: 10 }, context)).toBe(false);
  });

  it("returns false when there is not enough history", () => {
    expect(evaluateCondition(item, { field: "price", operator: "decreased" }, { getHistory: () => [{ value: 170, timestamp: "now" }] })).toBe(
      false
    );
  });
});