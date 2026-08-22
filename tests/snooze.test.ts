import { describe, expect, it } from "vitest";
import { runOnce } from "../src/runner.js";
import { isSnoozed, snoozeAlert, snoozedUntil, snoozeKey, MAX_SNOOZE_MINUTES } from "../src/snooze.js";
import { MemoryStateStore } from "../src/state/memory.js";
import type { Alert, BotConfig } from "../src/types.js";
import type { Notifier } from "../src/notifiers/types.js";

class CaptureNotifier implements Notifier {
  readonly name = "capture";
  readonly alerts: Alert[] = [];

  async send(alert: Alert): Promise<void> {
    this.alerts.push(alert);
  }
}

describe("snooze store", () => {
  it("stores an expiry and reports the alert as snoozed until then", async () => {
    const state = new MemoryStateStore();
    const now = Date.parse("2026-08-22T10:00:00.000Z");

    const result = await snoozeAlert(state, "alert-1", 60, now);
    expect(result.snoozedUntil).toBe("2026-08-22T11:00:00.000Z");
    expect(await isSnoozed(state, "alert-1", now)).toBe(true);
    expect(await snoozedUntil(state, "alert-1", now + 59 * 60_000)).toBe(result.snoozedUntil);
  });

  it("expires after the snooze window", async () => {
    const state = new MemoryStateStore();
    const now = Date.parse("2026-08-22T10:00:00.000Z");

    await snoozeAlert(state, "alert-1", 30, now);
    expect(await isSnoozed(state, "alert-1", now + 31 * 60_000)).toBe(false);
  });

  it("clamps the duration to the maximum", async () => {
    const state = new MemoryStateStore();
    const now = Date.parse("2026-08-22T10:00:00.000Z");

    const result = await snoozeAlert(state, "alert-1", MAX_SNOOZE_MINUTES * 10, now);
    expect(Date.parse(result.snoozedUntil) - now).toBe(MAX_SNOOZE_MINUTES * 60_000);
  });

  it("rejects invalid input", async () => {
    const state = new MemoryStateStore();
    await expect(snoozeAlert(state, "", 60)).rejects.toThrow(/alert id/i);
    await expect(snoozeAlert(state, "alert-1", 0)).rejects.toThrow(/positive/i);
    await expect(snoozeAlert(state, "alert-1", Number.NaN)).rejects.toThrow(/positive/i);
  });

  it("does not treat an unknown alert as snoozed", async () => {
    const state = new MemoryStateStore();
    expect(await isSnoozed(state, "unknown")).toBe(false);
  });
});

describe("runOnce with snoozed alerts", () => {
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

  it("collects but does not deliver snoozed alerts, then delivers after expiry", async () => {
    globalThis.fetch = async () =>
      new Response('<div class="item"><span class="title">Cable</span><span class="price">$9.00</span></div>', {
        status: 200
      });

    const state = new MemoryStateStore();
    const notifier = new CaptureNotifier();

    // Discover the alert id without marking state.
    const preview = await runOnce(config, { stateStore: state, notifiers: [notifier], dryRun: true, includeAlerts: true });
    const alertId = preview.alerts?.[0]?.id;
    expect(alertId).toBeTruthy();

    await snoozeAlert(state, alertId!, 60);

    const suppressed = await runOnce(config, { stateStore: state, notifiers: [notifier], includeAlerts: true });
    expect(suppressed.alertCount).toBe(1);
    expect(suppressed.snoozedCount).toBe(1);
    expect(suppressed.alerts?.[0]?.snoozed).toBe(true);
    expect(suppressed.alerts?.[0]?.snoozedUntil).toBeTruthy();
    expect(notifier.alerts).toHaveLength(0);

    // Force the snooze to lapse, then the alert delivers normally.
    await state.markAt(snoozeKey(alertId!), new Date(Date.now() - 1000).toISOString());

    const delivered = await runOnce(config, { stateStore: state, notifiers: [notifier], includeAlerts: true });
    expect(delivered.alertCount).toBe(1);
    expect(delivered.snoozedCount).toBe(0);
    expect(notifier.alerts).toHaveLength(1);
  });
});
