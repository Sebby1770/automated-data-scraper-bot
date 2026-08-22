import type { Alert, AlertSeverity } from "../types.js";
import type { Notifier } from "./types.js";

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2
};

export function severityRank(severity: AlertSeverity | undefined): number {
  return SEVERITY_RANK[severity ?? "info"];
}

/**
 * A notifier with routing metadata: a stable id that rules can target via
 * `notify: [...]`, and an optional severity floor.
 */
export class RoutedNotifier implements Notifier {
  constructor(
    private readonly inner: Notifier,
    readonly id: string,
    readonly minSeverity?: AlertSeverity
  ) {}

  get name(): string {
    return this.inner.name;
  }

  send(alert: Alert): Promise<void> {
    return this.inner.send(alert);
  }
}

function notifierId(notifier: Notifier): string {
  return notifier instanceof RoutedNotifier ? notifier.id : notifier.name;
}

function notifierFloor(notifier: Notifier): number {
  return notifier instanceof RoutedNotifier ? severityRank(notifier.minSeverity ?? "info") : 0;
}

/**
 * Pick the notifiers that should receive an alert:
 * - if the matching rule lists `notify` ids, only those notifiers qualify;
 * - a notifier's `minSeverity` filters out alerts below its floor.
 */
export function selectNotifiers(notifiers: Notifier[], alert: Alert, notify?: string[]): Notifier[] {
  const targeted = notify && notify.length > 0
    ? notifiers.filter((notifier) => notify.includes(notifierId(notifier)))
    : notifiers;

  return targeted.filter((notifier) => severityRank(alert.severity) >= notifierFloor(notifier));
}
