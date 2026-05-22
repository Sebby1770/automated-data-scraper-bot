import { describe, expect, it } from "vitest";
import { createAlert, evaluateCondition, evaluateRule, renderTemplate } from "../src/rules.js";
import type { DataItem, RuleConfig } from "../src/types.js";

const item: DataItem = {
  id: "item-1",
  sourceId: "stock",
  sourceLabel: "Stock feed",
  title: "TSLA 175",
  observedAt: "2026-05-22T00:00:00.000Z",
  data: {
    symbol: "TSLA.US",
    price: 175,
    summary: "Shares moved lower in the session"
  }
};

describe("rules", () => {
  it("matches numeric conditions", () => {
    expect(evaluateCondition(item, { field: "price", operator: "<=", value: 180 })).toBe(true);
    expect(evaluateCondition(item, { field: "price", operator: ">", value: 200 })).toBe(false);
  });

  it("matches text conditions case-insensitively", () => {
    expect(evaluateCondition(item, { field: "summary", operator: "contains", value: "LOWER" })).toBe(true);
    expect(evaluateCondition(item, { field: "summary", operator: "regex", value: "session$" })).toBe(true);
  });

  it("combines all and any clauses", () => {
    const rule: RuleConfig = {
      name: "price dip",
      source: "stock",
      all: [{ field: "price", operator: "<=", value: 180 }],
      any: [
        { field: "summary", operator: "contains", value: "rally" },
        { field: "symbol", operator: "contains", value: "TSLA" }
      ]
    };

    expect(evaluateRule(item, rule)).toBe(true);
  });

  it("renders alert templates from item fields", () => {
    expect(renderTemplate("{{symbol}} is {{price}}", item)).toBe("TSLA.US is 175");
  });

  it("creates stable alert ids for the rule and item", () => {
    const rule: RuleConfig = { name: "price dip", source: "stock" };
    expect(createAlert(item, rule).id).toBe(createAlert(item, rule).id);
  });
});
