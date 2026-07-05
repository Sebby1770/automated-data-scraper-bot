# Changelog

All notable changes to this project are documented in this file.

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