import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/config.js";

describe("validateConfig", () => {
  it("returns validation issues for the example config", () => {
    const result = validateConfig("config.example.yml");

    expect(result.valid).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });
});