import type { StateStore } from "./types.js";

export class MemoryStateStore implements StateStore {
  private readonly seen = new Set<string>();

  async has(key: string): Promise<boolean> {
    return this.seen.has(key);
  }

  async mark(key: string): Promise<void> {
    this.seen.add(key);
  }
}
