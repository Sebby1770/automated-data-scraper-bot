export interface MetricsSnapshot {
  scrapeRunsTotal: number;
  alertsTotal: number;
  sourcesCount: number;
  lastRunDurationMs: number;
}

const counters = {
  scrapeRunsTotal: 0,
  alertsTotal: 0,
  sourcesCount: 0,
  lastRunDurationMs: 0
};

export function recordScrapeRun(summary: {
  sourceCount: number;
  alertCount: number;
  startedAt: string;
  finishedAt: string;
}): void {
  counters.scrapeRunsTotal += 1;
  counters.alertsTotal += summary.alertCount;
  counters.sourcesCount = summary.sourceCount;
  counters.lastRunDurationMs =
    new Date(summary.finishedAt).getTime() - new Date(summary.startedAt).getTime();
}

export function getMetricsSnapshot(): MetricsSnapshot {
  return { ...counters };
}

export function formatPrometheusMetrics(snapshot = getMetricsSnapshot()): string {
  return [
    "# HELP scrape_runs_total Total number of scrape runs completed",
    "# TYPE scrape_runs_total counter",
    `scrape_runs_total ${snapshot.scrapeRunsTotal}`,
    "# HELP alerts_total Total alerts generated across all runs",
    "# TYPE alerts_total counter",
    `alerts_total ${snapshot.alertsTotal}`,
    "# HELP sources_count Number of configured sources in the last run",
    "# TYPE sources_count gauge",
    `sources_count ${snapshot.sourcesCount}`,
    "# HELP last_run_duration_ms Duration of the most recent scrape run in milliseconds",
    "# TYPE last_run_duration_ms gauge",
    `last_run_duration_ms ${snapshot.lastRunDurationMs}`,
    ""
  ].join("\n");
}

export function resetMetricsForTests(): void {
  counters.scrapeRunsTotal = 0;
  counters.alertsTotal = 0;
  counters.sourcesCount = 0;
  counters.lastRunDurationMs = 0;
}