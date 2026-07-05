# Changelog

All notable changes to this project are documented in this file.

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