# Changelog

All notable changes to this project are documented in this file.

## [0.7.0] - 2026-08-22

### Added

- Windowed rule operators that watch the recorded history instead of just the last
  value: `trend_up`, `trend_down`, `above_avg_pct`, `below_avg_pct`, `min_of_window`,
  and `max_of_window`, with a per-condition `window` (default 5). They stay quiet
  until enough history has accumulated.
- Per-rule notifier routing: notifiers accept a stable `id`, rules accept
  `notify: [ids]` to target specific channels.
- Per-notifier `minSeverity` floors so info-level alerts stay out of loud channels.
- Alert snoozing: **Snooze 1h** button on every dashboard alert row, a `Snoozed`
  badge and snoozed count in run summaries, and `POST /api/alerts/snooze`
  (dashboard-secret protected). Snoozed alerts keep matching but are not delivered
  (single or digest mode) until the snooze lapses; expiries are stored in the state
  backend (file, memory, or Upstash Redis) via a new `markAt` capability.

### Fixed

- `npm run typecheck` failure on `main` (`nl-rules.ts` between-parser indexing),
  which had turned CI red since v0.6.0.

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