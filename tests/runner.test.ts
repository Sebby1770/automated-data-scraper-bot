import { describe, expect, it } from "vitest";
import { runOnce } from "../src/runner.js";
import { MemoryStateStore } from "../src/state/memory.js";
import type { Alert, BotConfig } from "../src/types.js";
import type { Notifier } from "../src/notifiers/types.js";

class CaptureNotifier implements Notifier {
  readonly name = "capture";
  readonly alerts: Alert[] = [];

  constructor(private readonly fail = false) {}

  async send(alert: Alert): Promise<void> {
    if (this.fail) {
      throw new Error("simulated delivery failure");
    }
    this.alerts.push(alert);
  }
}

describe("runOnce", () => {
  it("deduplicates alerts by rule and item id", async () => {
    const state = new MemoryStateStore();
    const notifier = new CaptureNotifier();
    const config: BotConfig = {
      settings: {
        runIntervalSeconds: 300,
        userAgent: "test",
        requestTimeoutMs: 1000,
        maxConcurrency: 1,
        stateTtlDays: 30,
        digestMode: false,
        priceHistoryFields: ["price"],
        anomalyThresholdPercent: 20
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

    const first = await runOnce(config, { stateStore: state, notifiers: [notifier] });
    const second = await runOnce(config, { stateStore: state, notifiers: [notifier] });

    expect(first.alertCount).toBe(1);
    expect(second.alertCount).toBe(0);
    expect(notifier.alerts).toHaveLength(1);

    // A failed delivery must remain eligible for the next run instead of
    // being incorrectly deduplicated as if a notifier had succeeded.
    const retryState = new MemoryStateStore();
    const failed = await runOnce(config, {
      stateStore: retryState,
      notifiers: [new CaptureNotifier(true)]
    });
    const retriedNotifier = new CaptureNotifier();
    const retried = await runOnce(config, {
      stateStore: retryState,
      notifiers: [retriedNotifier]
    });
    expect(failed.errors).toContain("capture: simulated delivery failure");
    expect(failed.alertCount).toBe(1);
    expect(retried.alertCount).toBe(1);
    expect(retriedNotifier.alerts).toHaveLength(1);
  });
});
