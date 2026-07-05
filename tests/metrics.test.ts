import { describe, expect, it, beforeEach } from "vitest";
import { formatPrometheusMetrics, getMetricsSnapshot, recordScrapeRun, resetMetricsForTests } from "../src/metrics.js";

describe("metrics", () => {
  beforeEach(() => {
    resetMetricsForTests();
  });

  it("records scrape runs and formats prometheus output", () => {
    recordScrapeRun({
      sourceCount: 3,
      alertCount: 2,
      startedAt: "2026-07-05T10:00:00.000Z",
      finishedAt: "2026-07-05T10:00:01.500Z"
    });

    const snapshot = getMetricsSnapshot();
    expect(snapshot.scrapeRunsTotal).toBe(1);
    expect(snapshot.alertsTotal).toBe(2);
    expect(snapshot.sourcesCount).toBe(3);
    expect(snapshot.lastRunDurationMs).toBe(1500);

    const body = formatPrometheusMetrics(snapshot);
    expect(body).toContain("scrape_runs_total 1");
    expect(body).toContain("alerts_total 2");
    expect(body).toContain("sources_count 3");
    expect(body).toContain("last_run_duration_ms 1500");
  });
});