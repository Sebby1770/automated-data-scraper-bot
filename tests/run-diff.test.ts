import { describe, expect, it } from "vitest";
import { diffRuns, diffSummary, type RunFingerprint } from "../src/run-diff.js";

describe("diffRuns", () => {
  it("adds a new id in the order it first appears", () => {
    const diff = diffRuns(
      [{ id: "a", title: "Alpha" }],
      [
        { id: "c", title: "Citrus" },
        { id: "a", title: "Alpha again" },
        { id: "b", title: "Beta" },
        { id: "b", title: "Beta duplicate" }
      ]
    );

    expect(diff.added).toEqual([
      { id: "c", title: "Citrus" },
      { id: "b", title: "Beta" }
    ]);
    expect(diff.removed).toEqual([]);
  });

  it("removes a missing id in the order it first appears", () => {
    const diff = diffRuns(
      [
        { id: "b", title: "Beta" },
        { id: "a", title: "Alpha" },
        { id: "c", title: "Citrus" },
        { id: "b", title: "Beta again" }
      ],
      [{ id: "a", title: "Alpha" }]
    );

    expect(diff.removed).toEqual([
      { id: "b", title: "Beta" },
      { id: "c", title: "Citrus" }
    ]);
    expect(diff.added).toEqual([]);
  });

  it("returns empty lists for identical sets", () => {
    const alerts = [
      { id: "a", title: "Alpha" },
      { id: "b", title: "Beta" }
    ];

    expect(diffRuns(alerts, alerts)).toEqual({ added: [], removed: [] });
    expect(diffRuns(alerts, [...alerts].reverse())).toEqual({ added: [], removed: [] });
  });

  it("ignores empty ids and does not throw on missing fields", () => {
    const previous = [
      { id: "", title: "Blank old" },
      { title: "Missing id" } as RunFingerprint,
      { id: "a", title: "Alpha" },
      null
    ] as RunFingerprint[];
    const next = [
      { id: "", title: "Blank new" },
      { id: "b" } as RunFingerprint,
      undefined
    ] as RunFingerprint[];

    expect(() => diffRuns(previous, next)).not.toThrow();
    expect(diffRuns(previous, next)).toEqual({
      added: [{ id: "b", title: "" }],
      removed: [{ id: "a", title: "Alpha" }]
    });
  });

  it("caps inputs longer than 40", () => {
    const previous = Array.from({ length: 45 }, (_, index) => ({
      id: `old-${index}`,
      title: `Old ${index}`
    }));
    const next = Array.from({ length: 45 }, (_, index) => ({
      id: `new-${index}`,
      title: `New ${index}`
    }));

    const diff = diffRuns(previous, next);

    expect(diff.removed).toHaveLength(40);
    expect(diff.added).toHaveLength(40);
    expect(diff.removed.map((item) => item.id)).toEqual(previous.slice(0, 40).map((item) => item.id));
    expect(diff.added.map((item) => item.id)).toEqual(next.slice(0, 40).map((item) => item.id));
    expect(diff.removed.some((item) => item.id === "old-40")).toBe(false);
    expect(diff.added.some((item) => item.id === "new-40")).toBe(false);
  });
});

describe("diffSummary", () => {
  it("writes one sentence for titles that arrived or left", () => {
    expect(
      diffSummary({
        added: [{ id: "mug", title: "Ceramic mug" }],
        removed: [{ id: "plate", title: "Old plate" }]
      })
    ).toBe("Added Ceramic mug. Removed Old plate.");
  });

  it("joins several titles on one side and keeps a trailing period", () => {
    expect(
      diffSummary({
        added: [
          { id: "mug", title: "Ceramic mug" },
          { id: "bowl", title: "Blue bowl" }
        ],
        removed: []
      })
    ).toBe("Added Ceramic mug, Blue bowl.");
  });

  it("says there is no change, and falls back to the id when a title is blank", () => {
    expect(diffSummary({ added: [], removed: [] })).toBe("No alert changes");
    expect(diffSummary({ added: [{ id: "mug", title: "  " }], removed: [] })).toBe("Added mug.");
  });
});
