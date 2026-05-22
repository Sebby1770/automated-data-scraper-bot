import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { StateStore } from "./types.js";

type StateSnapshot = Record<string, string>;

export class FileStateStore implements StateStore {
  private state: StateSnapshot | undefined;

  constructor(
    private readonly filePath = process.env.STATE_FILE ?? "data/seen-items.json",
    private readonly ttlDays = 30
  ) {}

  async has(key: string): Promise<boolean> {
    const state = this.load();
    return state[key] !== undefined;
  }

  async mark(key: string): Promise<void> {
    const state = this.load();
    state[key] = new Date().toISOString();
    this.persist();
  }

  async prune(): Promise<void> {
    const state = this.load();
    const cutoff = Date.now() - this.ttlDays * 24 * 60 * 60 * 1000;

    for (const [key, value] of Object.entries(state)) {
      if (new Date(value).getTime() < cutoff) {
        delete state[key];
      }
    }

    this.persist();
  }

  private load(): StateSnapshot {
    if (this.state) {
      return this.state;
    }

    const absolutePath = resolve(process.cwd(), this.filePath);
    try {
      this.state = JSON.parse(readFileSync(absolutePath, "utf8")) as StateSnapshot;
    } catch {
      this.state = {};
    }

    return this.state;
  }

  private persist(): void {
    const absolutePath = resolve(process.cwd(), this.filePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, `${JSON.stringify(this.state ?? {}, null, 2)}\n`);
  }
}
