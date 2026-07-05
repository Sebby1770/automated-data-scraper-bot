# Automated Data Scraper Bot

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Sebby1770/automated-data-scraper-bot)
[![CI](https://github.com/Sebby1770/automated-data-scraper-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/Sebby1770/automated-data-scraper-bot/actions/workflows/ci.yml)
![Version](https://img.shields.io/badge/version-0.5.0-teal)
![Node](https://img.shields.io/badge/node-%3E%3D20-339933)

Config-driven bot and visual dashboard for watching retail listings, housing feeds, stock quotes, and JSON APIs, then notifying you through Discord, Telegram, or Slack when a rule matches.

It can run as a web app, a local long-lived process, a Docker container, a protected Vercel Cron endpoint, or an MCP tool server for Claude Desktop / Cursor.

## What It Does

- Opens a dashboard for sources, rules, notifier readiness, config validation, and manual scrape runs.
- Parses natural-language rule phrases into YAML (`alert when price is below 50`).
- Tracks price history and flags anomalies when values deviate sharply from recent averages.
- Shows sparkline charts and trend indicators in alert output.
- Batches alerts into digest summaries when `digestMode` is enabled.
- Tests rules against pasted JSON/HTML samples in the Rule Sandbox.
- Scrapes HTML pages with CSS selectors for retail or marketplace-style listings.
- Reads RSS feeds for housing/news-style sources.
- Pulls stock quote snapshots from Stooq's public CSV endpoint.
- Fetches JSON REST APIs with dot-notation field mappings.
- Evaluates `all` and `any` rule conditions.
- Deduplicates alerts so the same rule/item pair is not sent repeatedly.
- Sends alerts to console, Discord webhooks, Telegram bots, Slack incoming webhooks, or a generic JSON webhook.
- Compares current values to price history with `changed_by`, `changed_pct`, `increased`, and `decreased` rule operators.
- Suppresses live notifier sends during configurable quiet hours while still recording alerts.
- Exposes Prometheus metrics for scrape runs, alerts, sources, and last-run duration.
- Retries HTTP requests with exponential backoff.
- Supports persistent local state or Upstash Redis REST state for serverless deployments.
- Exposes MCP tools for programmatic control from AI assistants.

## Quick Start

```bash
npm install
npm run dev
```

Then open:

`http://localhost:5173`

Run the bot without the dashboard:

```bash
npm run scrape:once -- --dry-run
```

Create your own editable config:

```bash
npx tsx src/index.ts init
```

Then edit `config.yml`.

## Visual Dashboard

```bash
npm run dev
```

The dashboard calls the local API routes:

```text
GET  /api/config
GET  /api/config/profiles
GET  /api/config/validate
GET  /api/health
GET  /api/metrics
POST /api/run
POST /api/test-notifier
POST /api/nl-rules/parse
POST /api/sandbox/test
POST /api/digest/preview
```

Dashboard highlights in v0.5.0:

- **Config profiles** — switch between `config.example.yml` and files in `configs/` via dropdown
- **Dark mode** — toggle theme with persistence in browser `localStorage`
- **Quiet hours indicator** — shows when live notifier sends are suppressed
- **Grouped alerts** — expand/collapse alerts by rule name in run output
- **Webhook notifier test** — send a test JSON payload to `WEBHOOK_URL`

Dashboard highlights in v0.4.0:

- **Natural language rules** — describe a rule in English, preview parsed YAML, copy to clipboard
- **Rule sandbox** — paste JSON/HTML, pick a rule, see extracted fields and pass/fail conditions
- **Price sparklines** — mini SVG charts with ↑ ↓ → trend indicators on alerts with history
- **Anomaly badges** — highlights items where numeric fields deviate >20% from recent averages
- **Digest preview** — preview batched alert summaries before enabling `digestMode` in config
- **Validate config** button — surfaces warnings/errors before you run
- **Rule builder** modal — compose a rule and copy YAML to your clipboard
- **Notifier test** buttons — send a test alert to Discord, Telegram, or Slack
- **Source health** panel — per-source item counts, timestamps, and errors from the latest run
- Run history panel (last 10 runs, stored in browser `localStorage` as `scraperRunHistory`)
- Export matched alerts as JSON or CSV
- Rules table search/filter
- `Ctrl+Enter` to run a scrape
- Prominent run timestamps and duration in the output panel

Manual runs default to dry-run mode, which shows matching alerts without sending notifications. Switch to live alerts in the dashboard when you want notification adapters to send.

To protect manual runs and notifier tests on a deployed dashboard, set:

```bash
DASHBOARD_SECRET=your-long-random-secret
```

## Natural Language Rules

Type phrases like:

```text
alert when price is below 50
notify if title contains apartment
warn when summary exists
```

The dashboard parser extracts `field`, `operator`, and `value`, then generates YAML you can paste into `config.yml`.

## Digest Mode

Batch alerts into one summary per notifier instead of sending immediately:

```yaml
settings:
  digestMode: true
```

Use the dashboard **Digest preview** button after a run to see the formatted summary.

## Price History & Anomalies

```yaml
settings:
  priceHistoryFields: ["price"]
  anomalyThresholdPercent: 20
```

Each run records numeric snapshots (last 30 points per item). Alerts include sparklines and anomaly badges when a tracked field deviates sharply from its recent average.

## Rule Sandbox

Open **Rule sandbox** in the dashboard, paste sample JSON or HTML, choose a configured rule, and inspect:

- extracted field values
- per-condition pass/fail results
- overall match verdict

## MCP Server

Run the stdio MCP server:

```bash
npm run mcp
```

Exposed tools:

| Tool | Description |
|------|-------------|
| `run_scrape` | Execute one scrape pass (`dryRun` optional) |
| `list_sources` | List configured sources |
| `list_rules` | List configured alert rules |
| `get_health` | Return version and uptime |

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "data-scraper-bot": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/absolute/path/to/automated-data-scraper-bot"
    }
  }
}
```

### Cursor

Add an MCP server entry pointing at `npm run mcp` in the project directory. Set `CONFIG_PATH` if you use a custom config file.

## Notifications

Copy `.env.example` to `.env` and fill in whichever notifier you want:

```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
TELEGRAM_BOT_TOKEN=123456:abc...
TELEGRAM_CHAT_ID=123456789
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
WEBHOOK_URL=https://your-service.example.com/alerts
```

Enable the notifier in `config.yml`:

```yaml
notifiers:
  - type: discord
    enabled: true
    webhookUrlEnv: DISCORD_WEBHOOK_URL
  - type: slack
    enabled: true
    webhookUrlEnv: SLACK_WEBHOOK_URL
  - type: webhook
    enabled: true
    webhookUrlEnv: WEBHOOK_URL
```

Use the dashboard **Test** button next to each notifier to verify delivery.

## Quiet Hours

Suppress live notifier sends overnight while still recording alerts in run output:

```yaml
settings:
  quietHours:
    start: "23:00"
    end: "07:00"
    timezone: "local"
```

## Config Profiles

Set a default profile with `CONFIG_PATH` or switch profiles from the dashboard dropdown. Example profiles live in `configs/`:

- `configs/stocks-watch.yml` — stock quote and price-change rules
- `configs/retail-watch.yml` — retail demo with budget and increase rules

## Comparison Rules

Compare current numeric fields against the previous price-history snapshot:

```yaml
rules:
  - name: "TSLA price drop"
    source: tsla-stock
    all:
      - field: price
        operator: decreased
    message: "{{symbol}} dropped to {{price}} since the last check."

  - name: "Retail sharp move"
    source: retail-demo-books
    all:
      - field: price
        operator: changed_pct
        value: 10
    message: "{{title}} moved more than 10%: {{price}}"
```

Supported operators:

`<`, `<=`, `>`, `>=`, `==`, `!=`, `contains`, `not_contains`, `regex`, `exists`, `changed_by`, `changed_pct`, `increased`, `decreased`

## JSON Source Example

```yaml
sources:
  - id: json-api-demo
    type: json
    label: "JSON API demo"
    url: "https://jsonplaceholder.typicode.com/posts"
    itemsPath: ""
    idFields: ["id"]
    fields:
      title: "title"
      summary: "body"
```

## Rule Example

```yaml
rules:
  - name: "Retail item below budget"
    source: retail-demo-books
    all:
      - field: price
        operator: "<="
        value: 35
    message: "{{title}} is {{price}}: {{url}}"
```

## Docker

Build and run with Docker Compose:

```bash
docker compose up --build
```

Open `http://localhost:5173`.

Optional Redis profile (for Upstash-compatible REST env vars):

```bash
docker compose --profile redis up --build
```

Set `STATE_DRIVER=redis` and `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` in `.env` when using Redis-backed state.

## Vercel Cron

`vercel.json` schedules:

```json
{
  "path": "/api/cron/scrape",
  "schedule": "*/5 * * * *"
}
```

Set these environment variables in Vercel:

```bash
CRON_SECRET=your-long-random-secret
DASHBOARD_SECRET=optional-dashboard-secret
CONFIG_PATH=config.example.yml
DISCORD_WEBHOOK_URL=...
SLACK_WEBHOOK_URL=...
```

For persistent deduplication on Vercel, add Upstash Redis and set:

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
STATE_DRIVER=redis
```

Without Redis, serverless deployments may resend alerts after cold starts because local files are not durable.

## Local Scheduler

```bash
npm run scrape:watch
```

The interval is controlled by:

```yaml
settings:
  runIntervalSeconds: 300
```

## Responsible Scraping

Check each target site's terms and robots.txt. Prefer official APIs, feeds, or export endpoints when they exist. Keep intervals reasonable and identify your bot with a clear user agent. HTTP requests automatically retry with backoff on transient failures.

## Health Check

```bash
curl http://localhost:5173/api/health
```

Example response:

```json
{
  "ok": true,
  "data": {
    "version": "0.5.0",
    "uptime": 12.34
  }
}
```

## Config Validation

```bash
curl http://localhost:5173/api/config/validate
```

Returns warnings (missing env vars, empty rules) and errors (invalid references, schema issues).

## Prometheus Metrics

```bash
curl http://localhost:5173/api/metrics
```

Example output:

```text
# HELP scrape_runs_total Total number of scrape runs completed
# TYPE scrape_runs_total counter
scrape_runs_total 3
# HELP alerts_total Total alerts generated across all runs
# TYPE alerts_total counter
alerts_total 5
# HELP sources_count Number of configured sources in the last run
# TYPE sources_count gauge
sources_count 4
# HELP last_run_duration_ms Duration of the most recent scrape run in milliseconds
# TYPE last_run_duration_ms gauge
last_run_duration_ms 1240
```

## Scripts

```bash
npm run dev
npm run mcp
npm run app:build
npm run app:start
npm run scrape:once
npm run scrape:watch
npm run typecheck
npm run lint
npm test
npm run build
```

## Project Layout

```text
src/web/                React dashboard
src/server.ts           Local dashboard/API server
src/mcp-server.ts       MCP stdio tool server
src/nl-rules.ts         Natural language rule parser
src/digest.ts           Digest batching and formatting
src/sandbox.ts          Rule sandbox evaluator
src/anomaly.ts          Anomaly detection helpers
src/state/price-history.ts  Numeric field history store
api/cron/scrape.ts      Vercel Cron endpoint
api/config.ts           Dashboard config endpoint
api/config/validate.ts  Config validation endpoint
api/health.ts           Health/version endpoint
api/metrics.ts          Prometheus metrics endpoint
api/run.ts              Manual scrape endpoint
api/test-notifier.ts    Notifier test endpoint
src/sources/            HTML, RSS, JSON, and stock source adapters
src/rules.ts            Criteria engine and alert rendering
src/notifiers/          Console, Discord, Telegram, Slack, Webhook adapters
configs/                Example config profiles for dashboard switching
src/state/              File, memory, and Upstash Redis state
config.example.yml      Example watchlist and rules
Dockerfile              Multi-stage production image
docker-compose.yml      Local container orchestration
```