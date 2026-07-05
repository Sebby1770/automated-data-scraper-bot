import { describe, expect, it } from "vitest";
import { APP_VERSION, getConfigProfilesResponse, getHealthResponse, getMetricsResponse } from "../src/api.js";

describe("api", () => {
  it("returns health response with version and uptime", () => {
    const response = getHealthResponse();

    expect(response.ok).toBe(true);
    expect(response.data?.version).toBe(APP_VERSION);
    expect(response.data?.version).toBe("0.5.0");
    expect(response.data?.uptime).toBeGreaterThanOrEqual(0);
  });

  it("returns config profiles", () => {
    const response = getConfigProfilesResponse();
    expect(response.ok).toBe(true);
    expect(response.data?.profiles.length).toBeGreaterThan(0);
  });

  it("returns prometheus metrics", () => {
    const body = getMetricsResponse();
    expect(body).toContain("scrape_runs_total");
    expect(body).toContain("alerts_total");
    expect(body).toContain("sources_count");
    expect(body).toContain("last_run_duration_ms");
  });
});