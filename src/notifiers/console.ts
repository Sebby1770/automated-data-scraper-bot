import type { Alert } from "../types.js";
import type { Notifier } from "./types.js";

export class ConsoleNotifier implements Notifier {
  readonly name = "console";

  async send(alert: Alert): Promise<void> {
    const url = alert.url ? `\n${alert.url}` : "";
    console.log(`[alert:${alert.ruleName}] ${alert.message}${url}`);
  }
}
