import { describe, expect, it } from "vitest";
import { testRuleInSandbox } from "../src/sandbox.js";
import type { RuleConfig } from "../src/types.js";

const rule: RuleConfig = {
  name: "price watch",
  source: "retail",
  all: [{ field: "price", operator: "<=", value: 35 }]
};

describe("sandbox", () => {
  it("evaluates json samples against a rule", () => {
    const result = testRuleInSandbox({
      sample: JSON.stringify({ title: "Guide", price: 20, url: "https://example.com/guide" }),
      sampleType: "json",
      rule
    });

    expect(result.matched).toBe(true);
    expect(result.extractedFields.price).toBe(20);
    expect(result.conditions[0]?.passed).toBe(true);
  });

  it("reports non-matching json samples", () => {
    const result = testRuleInSandbox({
      sample: JSON.stringify({ title: "Luxury", price: 99 }),
      sampleType: "json",
      rule
    });

    expect(result.matched).toBe(false);
    expect(result.conditions[0]?.passed).toBe(false);
  });
});