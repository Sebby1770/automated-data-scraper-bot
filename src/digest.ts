import type { Notifier } from "./notifiers/types.js";
import type { Alert } from "./types.js";

export interface DigestPreview {
  alertCount: number;
  message: string;
  sections: Array<{ ruleName: string; count: number; titles: string[] }>;
}

export function formatDigest(alerts: Alert[]): string {
  if (alerts.length === 0) {
    return "No alerts matched during this run.";
  }

  const grouped = groupAlertsByRule(alerts);
  const lines = [
    `Scraper digest: ${alerts.length} alert${alerts.length === 1 ? "" : "s"} across ${grouped.length} rule${grouped.length === 1 ? "" : "s"}`,
    ""
  ];

  for (const group of grouped) {
    lines.push(`${group.ruleName} (${group.count})`);
    for (const title of group.titles.slice(0, 5)) {
      lines.push(`  • ${title}`);
    }
    if (group.titles.length > 5) {
      lines.push(`  • …and ${group.titles.length - 5} more`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

export function buildDigestPreview(alerts: Alert[]): DigestPreview {
  const sections = groupAlertsByRule(alerts);
  return {
    alertCount: alerts.length,
    message: formatDigest(alerts),
    sections
  };
}

export async function sendDigest(notifiers: Notifier[], alerts: Alert[], errors: string[]): Promise<void> {
  if (alerts.length === 0) {
    return;
  }

  const digestAlert = createDigestAlert(alerts);

  for (const notifier of notifiers) {
    try {
      await notifier.send(digestAlert);
    } catch (error) {
      errors.push(`${notifier.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function createDigestAlert(alerts: Alert[]): Alert {
  const matchedAt = new Date().toISOString();
  const message = formatDigest(alerts);
  const first = alerts[0];

  return {
    id: `digest-${matchedAt}`,
    ruleName: "digest",
    sourceId: "digest",
    sourceLabel: "Digest",
    title: `${alerts.length} alert${alerts.length === 1 ? "" : "s"} batched`,
    message,
    matchedAt,
    item: first.item
  };
}

function groupAlertsByRule(alerts: Alert[]): Array<{ ruleName: string; count: number; titles: string[] }> {
  const grouped = new Map<string, string[]>();

  for (const alert of alerts) {
    const titles = grouped.get(alert.ruleName) ?? [];
    titles.push(alert.title);
    grouped.set(alert.ruleName, titles);
  }

  return [...grouped.entries()].map(([ruleName, titles]) => ({
    ruleName,
    count: titles.length,
    titles
  }));
}