import { describe, expect, it } from "vitest";
import { evaluateCondition, type RuleEvaluationContext } from "../src/rules.js";
import type { DataItem } from "../src/types.js";
import type { PriceSnapshot } from "../src/state/price-history.js";

function makeItem(price: number): DataItem {
  return {
    id: "item-1",
    sourceId: "stock",
    sourceLabel: "Stock feed",
    title: `TSLA ${price}`,
    observedAt: "2026-08-22T00:00:00.000Z",
    data: { price }
  };
}

/** Builds a context whose history ends with the current observation. */
function contextWith(values: number[]): RuleEvaluationContext {
  const history: PriceSnapshot[] = values.map((value, index) => ({
    value,
    timestamp: new Date(Date.UTC(2026, 7, 1 + index)).toISOString()
  }));
  return { getHistory: () => history };
}

describe("windowed operators", () => {
  it("trend_up matches a strictly rising window", () => {
    const item = makeItem(50);
    expect(
      evaluateCondition(item, { field: "price", operator: "trend_up", window: 5 }, contextWith([10, 20, 30, 40, 50]))
    ).toBe(true);
    expect(
      evaluateCondition(item, { field: "price", operator: "trend_up", window: 5 }, contextWith([10, 20, 30, 35, 50]))
    ).toBe(true);
    expect(
      evaluateCondition(item, { field: "price", operator: "trend_up", window: 5 }, contextWith([10, 20, 30, 30, 50]))
    ).toBe(false);
  });

  it("trend_down matches a strictly falling window", () => {
    const item = makeItem(10);
    expect(
      evaluateCondition(item, { field: "price", operator: "trend_down", window: 4 }, contextWith([40, 30, 20, 10]))
    ).toBe(true);
    expect(
      evaluateCondition(item, { field: "price", operator: "trend_down", window: 4 }, contextWith([40, 45, 20, 10]))
    ).toBe(false);
  });

  it("fails windowed operators until enough history has accumulated", () => {
    const item = makeItem(50);
    expect(
      evaluateCondition(item, { field: "price", operator: "trend_up", window: 5 }, contextWith([40, 50]))
    ).toBe(false);
    expect(evaluateCondition(item, { field: "price", operator: "trend_up", window: 5 })).toBe(false);
  });

  it("above_avg_pct compares current to the prior window average", () => {
    // prior window average = (100 + 100 + 100) / 3 = 100
    const item = makeItem(125);
    const context = contextWith([100, 100, 100, 125]);
    expect(evaluateCondition(item, { field: "price", operator: "above_avg_pct", value: 20, window: 4 }, context)).toBe(true);
    expect(evaluateCondition(item, { field: "price", operator: "above_avg_pct", value: 30, window: 4 }, context)).toBe(false);
  });

  it("below_avg_pct compares current to the prior window average", () => {
    const item = makeItem(70);
    const context = contextWith([100, 100, 100, 70]);
    expect(evaluateCondition(item, { field: "price", operator: "below_avg_pct", value: 25, window: 4 }, context)).toBe(true);
    expect(evaluateCondition(item, { field: "price", operator: "below_avg_pct", value: 40, window: 4 }, context)).toBe(false);
  });

  it("min_of_window matches only a strict new low", () => {
    const item = makeItem(9);
    expect(
      evaluateCondition(item, { field: "price", operator: "min_of_window", window: 4 }, contextWith([12, 10, 11, 9]))
    ).toBe(true);
    // equal to the prior minimum is not a new low
    expect(
      evaluateCondition(item, { field: "price", operator: "min_of_window", window: 4 }, contextWith([12, 9, 11, 9]))
    ).toBe(false);
  });

  it("max_of_window matches only a strict new high", () => {
    const item = makeItem(20);
    expect(
      evaluateCondition(item, { field: "price", operator: "max_of_window", window: 4 }, contextWith([12, 15, 11, 20]))
    ).toBe(true);
    expect(
      evaluateCondition(item, { field: "price", operator: "max_of_window", window: 4 }, contextWith([12, 20, 11, 20]))
    ).toBe(false);
  });

  it("uses the default window of 5 when none is given", () => {
    const item = makeItem(9);
    // 4 prior + current = 5 observations
    expect(
      evaluateCondition(item, { field: "price", operator: "min_of_window" }, contextWith([12, 10, 11, 13, 9]))
    ).toBe(true);
    // only 3 prior — not enough for the default window
    expect(
      evaluateCondition(item, { field: "price", operator: "min_of_window" }, contextWith([12, 10, 11, 9]))
    ).toBe(false);
  });
});
