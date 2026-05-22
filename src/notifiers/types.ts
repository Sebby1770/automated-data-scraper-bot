import type { Alert } from "../types.js";

export interface Notifier {
  readonly name: string;
  send(alert: Alert): Promise<void>;
}
