import type { StateStore } from "./types.js";

export class MemoryStateStore implements StateStore {
  private readonly seen = new Map<string, string>();

  async has(key: string): Promise<boolean> {
    return this.seen.has(key);
  }

  async mark(key: string, timestamp = new Date().toISOString()): Promise<void> {
    this.seen.set(key, timestamp);
  }

  async markAt(key: string, timestamp: string): Promise<void> {
    this.seen.set(key, timestamp);
  }

  async seenAt(key: string): Promise<string | undefined> {
    return this.seen.get(key);
  }
}
