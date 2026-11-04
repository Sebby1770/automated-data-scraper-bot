import { describe, expect, it } from "vitest";
import { toPreviewItems } from "../src/preview.js";
import type { DataItem } from "../src/types.js";

function item(index: number): DataItem {
  return {
    id: `id-${index}`,
    sourceId: "local",
    sourceLabel: "Local",
    title: `Title ${index}`,
    url: index === 3 ? undefined : `https://example.test/${index}`,
    observedAt: "2026-11-04T00:00:00.000Z",
    data: {
      title: `Title ${index}`,
      note: "n".repeat(400),
      price: 12
    }
  };
}

describe("toPreviewItems", () => {
  it("returns at most 20 items and truncates long strings", () => {
    const preview = toPreviewItems(Array.from({ length: 25 }, (_, index) => item(index)));

    expect(preview).toHaveLength(20);
    expect(preview[0]).toMatchObject({
      id: "id-0",
      title: "Title 0",
      url: "https://example.test/0"
    });
    expect(preview[3]?.url).toBe("");
    expect(preview[0]?.fields.price).toBe("12");
    expect(preview[0]?.fields.note.length).toBeLessThanOrEqual(240);
    expect(preview[0]?.fields.note.endsWith("…")).toBe(true);
    expect(preview.some((entry) => entry.id === "id-20")).toBe(false);
  });
});
