import { isPathAllowed, parseRobotsTxt, selectGroup, type RobotsRules } from "./robots.js";
import type { SourceRuntimeOptions } from "./sources/types.js";
import { fetchText } from "./utils/http.js";

interface CachedRobots {
  rules: RobotsRules | null;
  crawlDelayMs: number;
}

const nextAllowedAt = new Map<string, number>();
const robotsCache = new Map<string, CachedRobots>();

export function resetPolitenessForTests(): void {
  nextAllowedAt.clear();
  robotsCache.clear();
}

export async function prepareRequest(url: string, options: SourceRuntimeOptions): Promise<void> {
  const configuredDelay = options.minHostIntervalMs ?? 0;
  if (!options.respectRobotsTxt) {
    await waitForHost(url, configuredDelay);
    return;
  }

  await waitForHost(url, configuredDelay);
  const decision = await inspectRobots(url, options);
  if (!decision.allowed) {
    throw new Error(`Blocked by robots.txt for ${url}`);
  }
  if (decision.crawlDelayMs > configuredDelay) {
    await waitForHost(url, decision.crawlDelayMs);
  }
}

export async function waitForHost(url: string, intervalMs: number): Promise<void> {
  if (intervalMs <= 0) {
    return;
  }

  const host = new URL(url).host;
  const now = Date.now();
  const readyAt = nextAllowedAt.get(host) ?? 0;
  const start = Math.max(now, readyAt);
  nextAllowedAt.set(host, start + intervalMs);
  if (start > now) {
    await sleep(start - now);
  }
}

async function inspectRobots(url: string, options: SourceRuntimeOptions): Promise<{ allowed: boolean; crawlDelayMs: number }> {
  const target = new URL(url);
  const cached = robotsCache.get(target.origin) ?? (await loadRobots(target.origin, options));
  if (!cached.rules) {
    return { allowed: true, crawlDelayMs: 0 };
  }

  return {
    allowed: isPathAllowed(cached.rules, options.userAgent, target.pathname || "/"),
    crawlDelayMs: cached.crawlDelayMs
  };
}

async function loadRobots(origin: string, options: SourceRuntimeOptions): Promise<CachedRobots> {
  try {
    const body = await fetchText(`${origin}/robots.txt`, options.userAgent, options.requestTimeoutMs);
    const rules = parseRobotsTxt(body);
    const group = selectGroup(rules, options.userAgent);
    const cached = { rules, crawlDelayMs: group?.crawlDelayMs ?? 0 };
    robotsCache.set(origin, cached);
    return cached;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/\b404\b/.test(message)) {
      const cached = { rules: null, crawlDelayMs: 0 };
      robotsCache.set(origin, cached);
      return cached;
    }
    throw new Error(`Could not read robots.txt for ${origin}: ${message}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
