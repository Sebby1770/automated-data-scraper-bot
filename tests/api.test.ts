import { afterEach, describe, expect, it } from "vitest";
import {
  APP_VERSION,
  getConfigProfilesResponse,
  getHealthResponse,
  getMetricsResponse,
  previewHttpStatus,
  previewSourceResponse
} from "../src/api.js";
import { getMetricsSnapshot, resetMetricsForTests } from "../src/metrics.js";

describe("api", () => {
  it("returns health response with version and uptime", () => {
    const response = getHealthResponse();

    expect(response.ok).toBe(true);
    expect(response.data?.version).toBe(APP_VERSION);
    expect(response.data?.version).toBe("0.14.0");
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

  describe("preview", () => {
    const previousSecret = process.env.DASHBOARD_SECRET;

    afterEach(() => {
      if (previousSecret === undefined) {
        delete process.env.DASHBOARD_SECRET;
      } else {
        process.env.DASHBOARD_SECRET = previousSecret;
      }
    });

    it("returns 400 when sourceId is missing and does not require a secret when none is configured", async () => {
      delete process.env.DASHBOARD_SECRET;
      const response = await previewSourceResponse({});

      expect(response.ok).toBe(false);
      expect(response.error).toBe("Missing sourceId");
      expect(previewHttpStatus(response)).toBe(400);
    });

    it("fails cleanly for an unknown source id without recording a scrape", async () => {
      delete process.env.DASHBOARD_SECRET;
      resetMetricsForTests();
      const before = getMetricsSnapshot();

      const response = await previewSourceResponse({
        sourceId: "not-a-real-source",
        configPath: "config.example.yml"
      });

      expect(response.ok).toBe(false);
      expect(response.error).toBe("Unknown source id: not-a-real-source");
      expect(previewHttpStatus(response)).toBe(404);
      expect(getMetricsSnapshot()).toEqual(before);
    });

    it("requires the dashboard secret when one is configured", async () => {
      process.env.DASHBOARD_SECRET = "test-secret";
      const response = await previewSourceResponse({ sourceId: "not-a-real-source" });

      expect(response.ok).toBe(false);
      expect(response.error).toBe("Unauthorized");
      expect(previewHttpStatus(response)).toBe(401);
    });
  });
});
