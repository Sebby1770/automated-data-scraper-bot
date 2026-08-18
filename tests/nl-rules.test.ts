import { describe, expect, it } from "vitest";
import { nlRuleToYaml, parseNlRule } from "../src/nl-rules.js";

describe("nl-rules", () => {
  it("parses numeric below rules", () => {
    const result = parseNlRule("alert when price is below 50");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.rule.field).toBe("price");
    expect(result.rule.operator).toBe("<");
    expect(result.rule.value).toBe(50);
  });

  it("parses text contains rules", () => {
    const result = parseNlRule("notify if title contains apartment");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.rule.field).toBe("title");
    expect(result.rule.operator).toBe("contains");
    expect(result.rule.value).toBe("apartment");
  });

  it("parses between and starts_with phrases", () => {
    const between = parseNlRule("alert when price is between 10 and 20");
    expect(between.ok).toBe(true);
    if (between.ok) {
      expect(between.rule.operator).toBe("between");
      expect(between.rule.value).toEqual([10, 20]);
    }

    const prefix = parseNlRule("notify if symbol starts with TSLA");
    expect(prefix.ok).toBe(true);
    if (prefix.ok) {
      expect(prefix.rule.operator).toBe("starts_with");
      expect(prefix.rule.value).toBe("TSLA");
    }
  });

  it("parses exists rules", () => {
    const result = parseNlRule("alert when url exists");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.rule.field).toBe("url");
    expect(result.rule.operator).toBe("exists");
    expect(result.rule.value).toBeUndefined();
  });

  it("returns yaml for parsed rules", () => {
    const result = parseNlRule("alert when price is below 50");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const yaml = nlRuleToYaml(result.rule, { name: "Budget watch", source: "retail" });
    expect(yaml).toContain('name: "Budget watch"');
    expect(yaml).toContain("source: retail");
    expect(yaml).toContain("field: price");
    expect(yaml).toContain("operator: <");
    expect(yaml).toContain("value: 50");
  });

  it("reports parse errors for empty input", () => {
    const result = parseNlRule("   ");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toMatch(/enter a rule description/i);
  });
});