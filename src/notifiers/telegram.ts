import type { Alert } from "../types.js";
import type { Notifier } from "./types.js";

export class TelegramNotifier implements Notifier {
  readonly name = "telegram";

  constructor(
    private readonly botToken: string,
    private readonly chatId: string
  ) {}

  async send(alert: Alert): Promise<void> {
    const text = [alert.message, alert.url].filter(Boolean).join("\n");
    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        chat_id: this.chatId,
        text,
        disable_web_page_preview: false
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram notification failed with ${response.status} ${response.statusText}: ${body}`);
    }
  }
}
