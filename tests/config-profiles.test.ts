import { describe, expect, it } from "vitest";
import { listConfigProfiles } from "../src/config.js";

describe("config profiles", () => {
  it("lists example and configs directory profiles", () => {
    const profiles = listConfigProfiles();
    const paths = profiles.map((profile) => profile.path);

    expect(paths).toContain("config.example.yml");
    expect(paths).toContain("configs/stocks-watch.yml");
    expect(paths).toContain("configs/retail-watch.yml");
  });
});