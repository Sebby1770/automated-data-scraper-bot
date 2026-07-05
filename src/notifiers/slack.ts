import type { Alert } from "../types.js";
import type { Notifier } from "./types.js";

export class SlackNotifier implements Notifier {
  readonly name = "slack";

  constructor(private readonly webhookUrl: string) {}

  async send(alert: Alert): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        text: alert.message,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: alert.title
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Rule:* ${alert.ruleName}\n*Source:* ${alert.sourceLabel}\n${alert.message}${alert.url ? `\n<${alert.url}|Open link>` : ""}`
            }
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed with ${response.status} ${response.statusText}`);
    }
  }
}