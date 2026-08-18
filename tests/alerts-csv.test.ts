import { describe, expect, it } from "vitest";
import { alertsToCsv } from "../src/alerts-csv.js";
import type { Alert } from "../src/types.js";

const alert: Alert = {
  id: "abc",
  ruleName: "price dip",
  sourceId: "stock",
  sourceLabel: "Stock feed",
  title: 'TSLA, "dip"',
  url: "https://example.test/tsla",
  message: "TSLA moved lower",
  matchedAt: "2026-08-19T10:00:00.000Z",
  severity: "warning",
  item: {
    id: "item-1",
    sourceId: "stock",
    sourceLabel: "Stock feed",
    title: "TSLA",
    observedAt: "2026-08-19T10:00:00.000Z",
    data: {}
  }
};

describe("alerts csv", () => {
  it("quotes cells that contain commas", () => {
    const csv = alertsToCsv([alert]);
    expect(csv.startsWith("id,ruleName,severity,sourceId,title,message,matchedAt,url\n")).toBe(true);
    expect(csv).toContain('"TSLA, ""dip"""');
    expect(csv).toContain("warning");
  });
});
