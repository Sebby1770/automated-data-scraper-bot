import type { Alert } from "./types.js";

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function alertsToCsv(alerts: Alert[]): string {
  const header = ["id", "ruleName", "severity", "sourceId", "title", "message", "matchedAt", "url"];
  const rows = alerts.map((alert) =>
    [
      alert.id,
      alert.ruleName,
      alert.severity ?? "info",
      alert.sourceId,
      alert.title,
      alert.message,
      alert.matchedAt,
      alert.url ?? ""
    ].map(csvCell).join(",")
  );
  return [header.join(","), ...rows].join("\n") + (rows.length ? "\n" : "");
}
