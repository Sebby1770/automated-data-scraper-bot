# Changelog

All notable changes to this project are documented in this file.

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