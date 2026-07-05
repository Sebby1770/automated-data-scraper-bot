import type { DataItem } from "./types.js";
import type { PriceSnapshot } from "./state/price-history.js";
import { readItemField } from "./state/price-history.js";
import { toNumber } from "./utils/object.js";

export const DEFAULT_ANOMALY_THRESHOLD_PERCENT = 20;

export interface AnomalyInfo {
  field: string;
  current: number;
  average: number;
  deviationPercent: number;
  explanation: string;
}

export function detectAnomalies(
  item: DataItem,
  historyByField: Record<string, PriceSnapshot[]>,
  thresholdPercent = DEFAULT_ANOMALY_THRESHOLD_PERCENT
): AnomalyInfo[] {
  const anomalies: AnomalyInfo[] = [];

  for (const [field, history] of Object.entries(historyByField)) {
    if (history.length < 2) {
      continue;
    }

    const current = toNumber(readItemField(item, field));
    if (current === undefined) {
      continue;
    }

    const prior = history.slice(0, -1);
    if (prior.length === 0) {
      continue;
    }

    const average = prior.reduce((sum, point) => sum + point.value, 0) / prior.length;
    if (average === 0) {
      continue;
    }

    const deviationPercent = Math.abs(((current - average) / average) * 100);
    if (deviationPercent <= thresholdPercent) {
      continue;
    }

    const direction = current > average ? "above" : "below";
    anomalies.push({
      field,
      current,
      average: round(average),
      deviationPercent: round(deviationPercent),
      explanation: `${field} is ${round(deviationPercent)}% ${direction} its recent average (${round(average)} → ${round(current)})`
    });
  }

  return anomalies;
}

export function pickPrimaryAnomaly(anomalies: AnomalyInfo[]): AnomalyInfo | undefined {
  if (anomalies.length === 0) {
    return undefined;
  }

  return [...anomalies].sort((left, right) => right.deviationPercent - left.deviationPercent)[0];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}