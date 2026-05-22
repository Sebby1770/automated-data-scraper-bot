import type { Alert } from "../types.js";
import type { Notifier } from "./types.js";

export class DiscordNotifier implements Notifier {
  readonly name = "discord";

  constructor(private readonly webhookUrl: string) {}

  async send(alert: Alert): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        content: alert.message,
        embeds: [
          {
            title: alert.title,
            url: alert.url,
            description: `Rule: ${alert.ruleName}\nSource: ${alert.sourceLabel}`,
            timestamp: alert.matchedAt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Discord notification failed with ${response.status} ${response.statusText}`);
    }
  }
}
