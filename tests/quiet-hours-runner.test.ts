import { describe, expect, it } from "vitest";
import { runOnce } from "../src/runner.js";
import { MemoryStateStore } from "../src/state/memory.js";
import { createMemoryPriceHistoryStore } from "../src/state/price-history.js";
import type { Alert, BotConfig } from "../src/types.js";
import type { Notifier } from "../src/notifiers/types.js";

class CaptureNotifier implements Notifier {
  readonly name = "capture";
  readonly alerts: Alert[] = [];

  async send(alert: Alert): Promise<void> {
    this.alerts.push(alert);
  }
}

describe("quiet hours in runOnce", () => {
  it("records alerts but suppresses notifier sends during quiet hours", async () => {
    const notifier = new CaptureNotifier();
    const config: BotConfig = {
      settings: {
        runIntervalSeconds: 300,
        userAgent: "test",
        requestTimeoutMs: 1000,
        maxConcurrency: 1,
        stateTtlDays: 30,
        quietHours: {
          start: "00:00",
          end: "23:59",
          timezone: "local"
        }
      },
      notifiers: [{ type: "console", enabled: false }],
      sources: [
        {
          id: "retail",
          type: "html",
          url: "https://example.com",
          itemSelector: ".item",
          fields: {
            title: { selector: ".title" },
            price: { selector: ".price", transform: "price" }
          }
        }
      ],
      rules: [
        {
          name: "below budget",
          source: "retail",
          all: [{ field: "price", operator: "<=", value: 20 }]
        }
      ]
    };

    globalThis.fetch = async () =>
      new Response('<div class="item"><span class="title">Cable</span><span class="price">$9.00</span></div>', {
        status: 200
      });

    const summary = await runOnce(config, {
      dryRun: false,
      stateStore: new MemoryStateStore(),
      priceHistoryStore: createMemoryPriceHistoryStore(),
      notifiers: [notifier],
      includeAlerts: true
    });

    expect(summary.alertCount).toBe(1);
    expect(summary.quietHoursActive).toBe(true);
    expect(summary.notificationsSuppressed).toBe(true);
    expect(notifier.alerts).toHaveLength(0);
    expect(summary.alerts?.length).toBe(1);
  });
});