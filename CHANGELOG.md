# Changelog

All notable changes to this project are documented in this file.

## [0.14.0] - 2026-11-05

### Added

- Since last run writes one sentence, such as `Added Ceramic mug. Removed Old plate.`, and a button copies that sentence. The sentence stays on the page if the clipboard is unavailable.

### Changed

- Bumped package version to `0.14.0`.

## [0.13.0] - 2026-11-04

### Added

- A website at `/` introduces the bot. The console stays at `/console`.

### Changed

- Bumped package version to `0.13.0`.

## [0.12.0] - 2026-11-04

### Added

- Run history compares alert ids from the two most recent dashboard runs and lists titles that were added or removed since the previous run.

### Changed

- Bumped package version to `0.12.0`.

## [0.11.0] - 2026-11-04

### Added

- Read-only source preview via `POST /api/preview` and a dashboard Preview button. One configured source is fetched with the same runtime options as a scrape, capped at 20 items, without notifications, text snapshots, price history, or scrape metrics.
- Cron next-run hint under the dashboard schedule for `*/N * * * *`, `M * * * *`, and `M H * * *`. Other expressions stay unestimated.
- Alert rows render each `changes` entry as a before → after pair in addition to the message.

### Changed

- Bumped package version to `0.11.0`.

## [0.10.0] - 2026-11-04

### Added

- Sitemap sources (`type: sitemap`). A urlset becomes one item per page, with `loc`, `lastmod`, and a title taken from the path. A sitemap index fetches up to 8 child sitemaps. `include` and `exclude` are regular expressions, and `maxUrls` caps the list at 200. Locations that are not `http` or `https` are dropped.
- Profile `configs/sitemap-watch.yml`.

### Changed

- Bumped package version to `0.10.0`.

## [0.9.0] - 2026-11-04

### Added

- `changed` alerts now include the previous text and the new text, both in the message (`title: "Mug" → "Cup"`) and on `alert.changes`.

### Changed

- Bumped package version to `0.9.0`.

## [0.8.0] - 2026-11-04

### Added

- HTML pagination via `pagination.nextSelector` and `pagination.maxPages` (capped at 10), plus a `regex` field transform with an optional capture `group`.
- CSV sources (`type: csv`) that map header rows to items and coerce numeric cells.
- `changed` rule operator and natural-language phrase (`alert when title changes`). The first observation is the baseline; later runs alert when that field's text differs. Snapshots persist in `data/text-snapshots.json`.
- Polite fetching: `settings.respectRobotsTxt`, `settings.minHostIntervalMs`, and `settings.conditionalRequests` (`If-None-Match` / 304). A missing robots.txt is treated as allowed. Crawl-delay is honored up to 5 seconds.
- Profile `configs/changes-watch.yml`.
- Dashboard chips for robots.txt and conditional GET, a CSV source icon, and the `changed` operator in the rule builder.

### Changed

- Bumped package version to `0.8.0`.

## [0.7.0] - 2026-09-02

### Added

- Local macOS Messages/iMessage notifier with dashboard and CLI test support.
- Explicit `IMESSAGE_ALLOW_SEND=true` live-send lock, one-recipient validation, bounded message length, and a per-run send cap.
- Readiness diagnostics for missing environment variables, locked sending, invalid recipients, and non-macOS hosts.
- Mock-boundary tests covering argv isolation, platform refusal, volume limits, error redaction, and readiness checks.

### Changed

- Dry-run and quiet-hours runs no longer construct notification adapters, making the no-send boundary explicit.
- Alerts are marked as delivered only after at least one notifier succeeds, allowing all-failure runs to retry next time.
- Dashboard notifier rows now surface iMessage setup state and allow a protected test send when ready.
- Bumped package version to `0.7.0`.

## [0.6.0] - 2026-08-19

### Added

- Rule operators `between`, `starts_with`, and `ends_with`, including NL parser phrases.
- Optional rule `severity` (`info` | `warning` | `critical`) copied onto alerts.
- Per-rule or global `cooldownMinutes` so the same alert can re-fire after a window instead of remaining permanently deduped.
- CSV export of alerts via `--export-csv` on `data-scraper-bot run`.

### Changed

- State stores now track `seenAt` timestamps so cooldown windows can be evaluated.
- Bumped package version to `0.6.0`.

## [0.5.0] - 2026-07-05

### Added

- Comparison rule operators in `src/rules.ts`: `changed_by`, `changed_pct`, `increased`, `decreased` (compare current values to price history)
- Generic webhook notifier (`src/notifiers/webhook.ts`) posting alert JSON to `WEBHOOK_URL`
- Quiet hours (`settings.quietHours`) suppressing live notifier sends while still recording alerts
- Dashboard dark mode toggle with `localStorage` persistence and full theme in `styles.css`
- Config profiles via `CONFIG_PATH`, `configs/` folder, dashboard dropdown, and `GET /api/config/profiles`
- Example profiles: `configs/stocks-watch.yml` and `configs/retail-watch.yml`
- Prometheus metrics endpoint `GET /api/metrics` (`scrape_runs_total`, `alerts_total`, `sources_count`, `last_run_duration_ms`)
- Dashboard alert grouping by rule name with expand/collapse
- Tests for comparison rules, quiet hours, metrics, webhook notifier, and config profiles

### Changed

- Bumped package version to `0.5.0`
- `RunSummary` now includes `quietHoursActive` and `notificationsSuppressed`
- Dashboard shows quiet-hours indicator and webhook notifier test button
- Updated README with v0.5.0 features and metrics endpoint

## [0.4.0] - 2026-07-05

### Added

- Natural language rule parser (`src/nl-rules.ts`) with dashboard "Describe a rule" panel and `POST /api/nl-rules/parse`
- Price history tracker (`src/state/price-history.ts`) storing the last 30 numeric snapshots per item
- Sparkline charts and price trend indicators (↑ ↓ →) in dashboard alert output
- Digest mode (`src/digest.ts`) via `settings.digestMode: true` to batch alerts into one summary per notifier
- Dashboard digest preview via `POST /api/digest/preview`
- Rule sandbox (`src/sandbox.ts`) with dashboard modal and `POST /api/sandbox/test`
- Anomaly detection (`src/anomaly.ts`) flagging numeric fields that deviate >20% from historical average
- MCP stdio server (`src/mcp-server.ts`) exposing `run_scrape`, `list_sources`, `list_rules`, and `get_health`
- `npm run mcp` script for Claude Desktop / Cursor integration
- Tests for NL rules, price history, anomalies, digest, and sandbox

### Changed

- Bumped package version to `0.4.0`
- `RunSummary` now includes `priceHistory` updates and `digestMode`
- Alerts can include `anomaly` and `priceHistory` metadata for dashboard badges and sparklines
- Updated README with v0.4.0 features, badges, and MCP usage

## [0.3.0] - 2026-07-05

### Added

- Slack webhook notifier (`src/notifiers/slack.ts`) with `SLACK_WEBHOOK_URL` support
- `POST /api/test-notifier` endpoint and dashboard test buttons for Discord, Telegram, and Slack
- Per-source health tracking in `RunSummary.sourceHealth` with dashboard Source Health panel
- `validateConfig()` in `config.ts` and `GET /api/config/validate` endpoint with dashboard Validate button
- Visual rule builder modal that exports YAML snippets to the clipboard
- JSON REST source adapter (`src/sources/json.ts`) with dot-notation `itemsPath` and field mappings
- HTTP retry/backoff via `fetchWithRetry()` in `src/utils/http.ts`
- Docker support with multi-stage `Dockerfile` and `docker-compose.yml`
- Tests for JSON source adapter and config validation

### Changed

- Bumped package version to `0.3.0`
- Updated README with deploy badge, Slack/JSON/Docker docs, and new dashboard features

## [0.2.0] - 2026-07-05

### Added

- Dashboard run history panel storing the last 10 runs in `localStorage` (`scraperRunHistory`)
- Alert export buttons for JSON and CSV downloads
- Rules table search/filter
- `Ctrl+Enter` keyboard shortcut to trigger a scrape
- Prominent run timestamps and duration in the run output panel
- `GET /api/health` endpoint with app version and uptime (`APP_VERSION = "0.2.0"`)
- Vercel serverless handler at `api/health.ts`
- GitHub Actions CI workflow (typecheck, lint, test)

### Changed

- Bumped package version to `0.2.0`
- Updated README with health endpoint and new dashboard features
