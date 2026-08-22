import { describe, expect, it } from "vitest";
import { createNotifiers } from "../src/notifiers/index.js";
import { RoutedNotifier, selectNotifiers, severityRank } from "../src/notifiers/routing.js";
import type { Notifier } from "../src/notifiers/types.js";
import type { Alert } from "../src/types.js";

class CaptureNotifier implements Notifier {
  readonly alerts: Alert[] = [];

  constructor(readonly name: string) {}

  async send(alert: Alert): Promise<void> {
    this.alerts.push(alert);
  }
}

function makeAlert(severity?: Alert["severity"]): Alert {
  const matchedAt = new Date().toISOString();
  return {
    id: "alert-1",
    ruleName: "rule",
    sourceId: "source",
    sourceLabel: "Source",
    title: "Title",
    message: "Message",
    matchedAt,
    severity,
    item: {
      id: "item",
      sourceId: "source",
      sourceLabel: "Source",
      title: "Title",
      observedAt: matchedAt,
      data: {}
    }
  };
}

describe("notifier routing", () => {
  it("ranks severities in order", () => {
    expect(severityRank("info")).toBeLessThan(severityRank("warning"));
    expect(severityRank("warning")).toBeLessThan(severityRank("critical"));
    expect(severityRank(undefined)).toBe(severityRank("info"));
  });

  it("delivers to all notifiers when the rule has no notify list", () => {
    const notifiers = [new CaptureNotifier("a"), new CaptureNotifier("b")];
    expect(selectNotifiers(notifiers, makeAlert())).toHaveLength(2);
  });

  it("targets only the notifiers listed in notify", () => {
    const a = new RoutedNotifier(new CaptureNotifier("a"), "ops-telegram");
    const b = new RoutedNotifier(new CaptureNotifier("b"), "team-slack");
    const selected = selectNotifiers([a, b], makeAlert(), ["team-slack"]);
    expect(selected).toHaveLength(1);
    expect(selected[0]).toBe(b);
  });

  it("falls back to the notifier name for un-routed notifiers", () => {
    const plain = new CaptureNotifier("capture");
    expect(selectNotifiers([plain], makeAlert(), ["capture"])).toHaveLength(1);
    expect(selectNotifiers([plain], makeAlert(), ["something-else"])).toHaveLength(0);
  });

  it("suppresses alerts below a notifier's minSeverity floor", () => {
    const pager = new RoutedNotifier(new CaptureNotifier("pager"), "pager", "critical");
    const log = new RoutedNotifier(new CaptureNotifier("log"), "log");

    expect(selectNotifiers([pager, log], makeAlert("info"))).toHaveLength(1);
    expect(selectNotifiers([pager, log], makeAlert("warning"))).toHaveLength(1);
    expect(selectNotifiers([pager, log], makeAlert("critical"))).toHaveLength(2);
  });

  it("combines notify targeting with severity floors", () => {
    const pager = new RoutedNotifier(new CaptureNotifier("pager"), "pager", "warning");
    const selected = selectNotifiers([pager], makeAlert("info"), ["pager"]);
    expect(selected).toHaveLength(0);
  });

  it("createNotifiers assigns ids and severity floors from config", () => {
    const [notifier] = createNotifiers([{ type: "console", id: "term", minSeverity: "warning" }]);
    expect(notifier).toBeInstanceOf(RoutedNotifier);
    expect((notifier as RoutedNotifier).id).toBe("term");
    expect((notifier as RoutedNotifier).minSeverity).toBe("warning");
  });

  it("createNotifiers defaults the id to the notifier type", () => {
    const [notifier] = createNotifiers([{ type: "console" }]);
    expect((notifier as RoutedNotifier).id).toBe("console");
  });
});
