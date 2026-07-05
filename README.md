# Automated Data Scraper Bot

Config-driven bot and visual dashboard for watching retail listings, housing feeds, and stock quotes, then notifying you through Discord or Telegram when a rule matches.

It can run as a web app, a local long-lived process, or a protected Vercel Cron endpoint.

## What It Does

- Opens a dashboard for sources, rules, notifier readiness, and manual scrape runs.
- Scrapes HTML pages with CSS selectors for retail or marketplace-style listings.
- Reads RSS feeds for housing/news-style sources.
- Pulls stock quote snapshots from Stooq's public CSV endpoint.
- Evaluates `all` and `any` rule conditions.
- Deduplicates alerts so the same rule/item pair is not sent repeatedly.
- Sends alerts to console, Discord webhooks, or Telegram bots.
- Supports persistent local state or Upstash Redis REST state for serverless deployments.

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
GET  /api/health
POST /api/run
```

Dashboard highlights in v0.2.0:

- Run history panel (last 10 runs, stored in browser `localStorage` as `scraperRunHistory`)
- Export matched alerts as JSON or CSV
- Rules table search/filter
- `Ctrl+Enter` to run a scrape
- Prominent run timestamps and duration in the output panel

Manual runs default to dry-run mode, which shows matching alerts without sending Discord or Telegram notifications. Switch to live alerts in the dashboard when you want notification adapters to send.

To protect manual runs on a deployed dashboard, set:

```bash
DASHBOARD_SECRET=your-long-random-secret
```

## Notifications

Copy `.env.example` to `.env` and fill in whichever notifier you want:

```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
TELEGRAM_BOT_TOKEN=123456:abc...
TELEGRAM_CHAT_ID=123456789
```

Enable the notifier in `config.yml`:

```yaml
notifiers:
  - type: discord
    enabled: true
    webhookUrlEnv: DISCORD_WEBHOOK_URL
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

Supported operators:

`<`, `<=`, `>`, `>=`, `==`, `!=`, `contains`, `not_contains`, `regex`, `exists`

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

Check each target site's terms and robots.txt. Prefer official APIs, feeds, or export endpoints when they exist. Keep intervals reasonable and identify your bot with a clear user agent.

## Health Check

```bash
curl http://localhost:5173/api/health
```

Example response:

```json
{
  "ok": true,
  "data": {
    "version": "0.2.0",
    "uptime": 12.34
  }
}
```

## Scripts

```bash
npm run dev
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
api/cron/scrape.ts      Vercel Cron endpoint
api/config.ts           Dashboard config endpoint
api/health.ts           Health/version endpoint
api/run.ts              Manual scrape endpoint
src/sources/            HTML, RSS, and stock source adapters
src/rules.ts            Criteria engine and alert rendering
src/notifiers/          Console, Discord, Telegram adapters
src/state/              File, memory, and Upstash Redis state
config.example.yml      Example watchlist and rules
```
