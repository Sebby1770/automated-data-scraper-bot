import { describe, expect, it } from "vitest";
import { isQuietHours, parseTimeToMinutes } from "../src/quiet-hours.js";

describe("quiet hours", () => {
  it("parses HH:MM times", () => {
    expect(parseTimeToMinutes("23:00")).toBe(23 * 60);
    expect(parseTimeToMinutes("07:30")).toBe(7 * 60 + 30);
    expect(parseTimeToMinutes("invalid")).toBeUndefined();
  });

  it("detects quiet hours within the same day", () => {
    const now = new Date("2026-07-05T01:30:00");
    expect(
      isQuietHours(
        {
          start: "23:00",
          end: "07:00",
          timezone: "local"
        },
        now
      )
    ).toBe(true);
  });

  it("returns false outside quiet hours", () => {
    const now = new Date("2026-07-05T12:00:00");
    expect(
      isQuietHours(
        {
          start: "23:00",
          end: "07:00",
          timezone: "local"
        },
        now
      )
    ).toBe(false);
  });
});