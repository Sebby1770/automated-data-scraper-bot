import type { StateStore } from "./types.js";

export class UpstashRedisStateStore implements StateStore {
  constructor(
    private readonly restUrl: string,
    private readonly token: string,
    private readonly ttlSeconds: number
  ) {}

  async has(key: string): Promise<boolean> {
    const result = await this.request<{ result: unknown }>(`get/${encodeURIComponent(key)}`);
    return result.result !== null;
  }

  async mark(key: string): Promise<void> {
    await this.request(`set/${encodeURIComponent(key)}/${encodeURIComponent(new Date().toISOString())}?EX=${this.ttlSeconds}`);
  }

  private async request<T = unknown>(path: string): Promise<T> {
    const response = await fetch(`${this.restUrl.replace(/\/$/, "")}/${path}`, {
      headers: {
        authorization: `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Upstash Redis request failed with ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  }
}
