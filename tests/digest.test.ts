import { describe, expect, it } from "vitest";
import { buildDigestPreview, formatDigest } from "../src/digest.js";
import type { Alert } from "../src/types.js";

function makeAlert(ruleName: string, title: string): Alert {
  const matchedAt = "2026-07-05T00:00:00.000Z";
  return {
    id: `${ruleName}-${title}`,
    ruleName,
    sourceId: "demo",
    sourceLabel: "Demo",
    title,
    message: title,
    matchedAt,
    item: {
      id: title,
      sourceId: "demo",
      sourceLabel: "Demo",
      title,
      observedAt: matchedAt,
      data: {}
    }
  };
}

describe("digest", () => {
  it("formats grouped digest messages", () => {
    const message = formatDigest([
      makeAlert("budget", "Book A"),
      makeAlert("budget", "Book B"),
      makeAlert("keyword", "Headline")
    ]);

    expect(message).toContain("3 alerts");
    expect(message).toContain("budget (2)");
    expect(message).toContain("Book A");
  });

  it("builds preview sections", () => {
    const preview = buildDigestPreview([makeAlert("budget", "Book A")]);
    expect(preview.alertCount).toBe(1);
    expect(preview.sections[0]?.ruleName).toBe("budget");
  });
});