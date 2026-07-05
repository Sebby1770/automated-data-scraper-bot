import { describe, expect, it, vi } from "vitest";
import { WebhookNotifier } from "../src/notifiers/webhook.js";
import type { Alert } from "../src/types.js";

const alert: Alert = {
  id: "alert-1",
  ruleName: "test-rule",
  sourceId: "demo",
  sourceLabel: "Demo",
  title: "Test alert",
  message: "Hello webhook",
  matchedAt: "2026-07-05T10:00:00.000Z",
  item: {
    id: "item-1",
    sourceId: "demo",
    sourceLabel: "Demo",
    title: "Test alert",
    observedAt: "2026-07-05T10:00:00.000Z",
    data: {}
  }
};

describe("webhook notifier", () => {
  it("posts alert json to the configured url", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    globalThis.fetch = fetchMock as typeof fetch;

    const notifier = new WebhookNotifier("https://example.com/hook");
    await notifier.send(alert);

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/hook", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: alert.id,
        ruleName: alert.ruleName,
        sourceId: alert.sourceId,
        sourceLabel: alert.sourceLabel,
        title: alert.title,
        url: alert.url,
        message: alert.message,
        matchedAt: alert.matchedAt,
        anomaly: alert.anomaly,
        priceHistory: alert.priceHistory
      })
    });
  });
});