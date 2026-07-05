import type { Alert } from "../types.js";
import type { Notifier } from "./types.js";

export class WebhookNotifier implements Notifier {
  readonly name = "webhook";

  constructor(private readonly webhookUrl: string) {}

  async send(alert: Alert): Promise<void> {
    const response = await fetch(this.webhookUrl, {
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

    if (!response.ok) {
      throw new Error(`Webhook notification failed with ${response.status} ${response.statusText}`);
    }
  }
}