import { describe, expect, it } from "vitest";
import { APP_VERSION, getHealthResponse } from "../src/api.js";

describe("api", () => {
  it("returns health response with version and uptime", () => {
    const response = getHealthResponse();

    expect(response.ok).toBe(true);
    expect(response.data?.version).toBe(APP_VERSION);
    expect(response.data?.version).toBe("0.2.0");
    expect(response.data?.uptime).toBeGreaterThanOrEqual(0);
  });
});