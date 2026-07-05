import { describe, expect, it } from "vitest";
import { detectAnomalies } from "../src/anomaly.js";
import type { DataItem } from "../src/types.js";

const item: DataItem = {
  id: "item-1",
  sourceId: "stock",
  sourceLabel: "Stock",
  title: "TSLA",
  observedAt: "2026-07-05T00:00:00.000Z",
  data: { price: 250 }
};

describe("anomaly detection", () => {
  it("flags large deviations from historical average", () => {
    const anomalies = detectAnomalies(
      item,
      {
        price: [
          { value: 100, timestamp: "2026-07-01T00:00:00.000Z" },
          { value: 110, timestamp: "2026-07-02T00:00:00.000Z" },
          { value: 250, timestamp: "2026-07-05T00:00:00.000Z" }
        ]
      },
      20
    );

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.field).toBe("price");
    expect(anomalies[0]?.deviationPercent).toBeGreaterThan(20);
  });

  it("ignores stable values", () => {
    const anomalies = detectAnomalies(
      { ...item, data: { price: 102 } },
      {
        price: [
          { value: 100, timestamp: "2026-07-01T00:00:00.000Z" },
          { value: 101, timestamp: "2026-07-02T00:00:00.000Z" },
          { value: 102, timestamp: "2026-07-05T00:00:00.000Z" }
        ]
      },
      20
    );

    expect(anomalies).toHaveLength(0);
  });
});