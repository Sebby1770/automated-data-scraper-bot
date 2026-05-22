# Automated Data Scraper Bot

Config-driven bot for watching retail listings, housing feeds, and stock quotes, then notifying you through Discord or Telegram when a rule matches.

It can run locally as a long-lived process or as a protected Vercel Cron endpoint.

## What It Does

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
npm run scrape:once
```

Create your own config:

```bash
npm run scrape:once -- --dry-run
npm run build
```

To make a real editable config:

```bash
npx tsx src/index.ts init
```

Then edit `config.yml`.

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

## Scripts

```bash
npm run scrape:once
npm run scrape:watch
npm run typecheck
npm test
npm run build
```

## Project Layout

```text
api/cron/scrape.ts      Vercel Cron endpoint
src/sources/            HTML, RSS, and stock source adapters
src/rules.ts            Criteria engine and alert rendering
src/notifiers/          Console, Discord, Telegram adapters
src/state/              File, memory, and Upstash Redis state
config.example.yml      Example watchlist and rules
```
