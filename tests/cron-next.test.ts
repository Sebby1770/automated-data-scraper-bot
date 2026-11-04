import { describe, expect, it } from "vitest";
import { nextCronRun } from "../src/cron-next.js";

describe("nextCronRun", () => {
  const from = new Date(2026, 5, 15, 10, 7, 30, 0);

  it("supports every N minutes", () => {
    const next = nextCronRun("*/5 * * * *", from);
    expect(next).not.toBeNull();
    expect(next?.getFullYear()).toBe(2026);
    expect(next?.getMonth()).toBe(5);
    expect(next?.getDate()).toBe(15);
    expect(next?.getHours()).toBe(10);
    expect(next?.getMinutes()).toBe(10);
    expect(next?.getSeconds()).toBe(0);
    expect(from.getMinutes()).toBe(7);
  });

  it("wraps */N to the next hour when the current hour has no later match", () => {
    const late = new Date(2026, 5, 15, 10, 56, 30, 0);
    const next = nextCronRun("*/7 * * * *", late);
    expect(next?.getHours()).toBe(11);
    expect(next?.getMinutes()).toBe(0);
  });

  it("supports a fixed minute", () => {
    const next = nextCronRun("15 * * * *", from);
    expect(next?.getHours()).toBe(10);
    expect(next?.getMinutes()).toBe(15);
    expect(next?.getSeconds()).toBe(0);
  });

  it("rolls a fixed minute into the next hour", () => {
    const next = nextCronRun("0 * * * *", from);
    expect(next?.getHours()).toBe(11);
    expect(next?.getMinutes()).toBe(0);
  });

  it("supports a fixed minute and hour", () => {
    const next = nextCronRun("30 14 * * *", from);
    expect(next?.getDate()).toBe(15);
    expect(next?.getHours()).toBe(14);
    expect(next?.getMinutes()).toBe(30);
  });

  it("rolls a fixed minute and hour to the next day", () => {
    const next = nextCronRun("5 9 * * *", from);
    expect(next?.getDate()).toBe(16);
    expect(next?.getHours()).toBe(9);
    expect(next?.getMinutes()).toBe(5);
  });

  it("keeps an exact matching instant", () => {
    const exact = new Date(2026, 5, 15, 10, 10, 0, 0);
    expect(nextCronRun("*/5 * * * *", exact)?.getTime()).toBe(exact.getTime());
    expect(nextCronRun("10 10 * * *", exact)?.getTime()).toBe(exact.getTime());
  });

  it("returns null for an unsupported expression", () => {
    expect(nextCronRun("* * * * *", from)).toBeNull();
    expect(nextCronRun("0 0 * * 1", from)).toBeNull();
    expect(nextCronRun("*/60 * * * *", from)).toBeNull();
    expect(nextCronRun("*/0 * * * *", from)).toBeNull();
    expect(nextCronRun("60 * * * *", from)).toBeNull();
    expect(nextCronRun("0 24 * * *", from)).toBeNull();
    expect(nextCronRun("*/5 1 * * *", from)).toBeNull();
    expect(nextCronRun("0,15 * * * *", from)).toBeNull();
    expect(nextCronRun("", from)).toBeNull();
  });
});
