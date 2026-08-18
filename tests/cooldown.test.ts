import { describe, expect, it } from "vitest";
import { resolveCooldownMinutes, shouldSkipDuplicate } from "../src/cooldown.js";
import { MemoryStateStore } from "../src/state/memory.js";

describe("cooldown", () => {
  it("uses the rule cooldown over the default", () => {
    expect(resolveCooldownMinutes({ cooldownMinutes: 15 }, 60)).toBe(15);
    expect(resolveCooldownMinutes({}, 60)).toBe(60);
    expect(resolveCooldownMinutes({}, undefined)).toBe(0);
  });

  it("skips unseen ids never and permanent dedup when cooldown is 0", async () => {
    const state = new MemoryStateStore();
    expect(await shouldSkipDuplicate(state, "a", 0)).toBe(false);
    await state.mark("a");
    expect(await shouldSkipDuplicate(state, "a", 0)).toBe(true);
  });

  it("re-alerts after the cooldown window", async () => {
    const state = new MemoryStateStore();
    await state.mark("a", "2026-08-19T10:00:00.000Z");
    const now = Date.parse("2026-08-19T10:10:00.000Z");
    expect(await shouldSkipDuplicate(state, "a", 15, now)).toBe(true);
    expect(await shouldSkipDuplicate(state, "a", 5, now)).toBe(false);
  });
});
