export interface RobotsGroup {
  agents: string[];
  allow: string[];
  disallow: string[];
  crawlDelayMs: number;
}

export interface RobotsRules {
  groups: RobotsGroup[];
}

const MAX_CRAWL_DELAY_MS = 5_000;

export function parseRobotsTxt(text: string): RobotsRules {
  const groups: RobotsGroup[] = [];
  let agents: string[] = [];
  let allow: string[] = [];
  let disallow: string[] = [];
  let crawlDelayMs = 0;
  let seenRule = false;

  const push = () => {
    if (agents.length > 0) {
      groups.push({ agents, allow, disallow, crawlDelayMs });
    }
    agents = [];
    allow = [];
    disallow = [];
    crawlDelayMs = 0;
    seenRule = false;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) {
      push();
      continue;
    }

    const splitAt = line.indexOf(":");
    if (splitAt < 0) {
      continue;
    }

    const key = line.slice(0, splitAt).trim().toLowerCase();
    const value = line.slice(splitAt + 1).trim();

    if (key === "user-agent") {
      if (seenRule) {
        push();
      }
      agents.push(value.toLowerCase());
      continue;
    }

    if (key === "allow") {
      seenRule = true;
      allow.push(value);
    } else if (key === "disallow") {
      seenRule = true;
      disallow.push(value);
    } else if (key === "crawl-delay") {
      seenRule = true;
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds > 0) {
        crawlDelayMs = Math.min(MAX_CRAWL_DELAY_MS, Math.round(seconds * 1000));
      }
    }
  }

  push();
  return { groups };
}

export function selectGroup(rules: RobotsRules, userAgent: string): RobotsGroup | undefined {
  const agent = userAgent.toLowerCase();
  let best: { group: RobotsGroup; length: number } | undefined;

  for (const group of rules.groups) {
    for (const token of group.agents) {
      if (token === "*" || !token) {
        continue;
      }
      if (agent.includes(token) && (!best || token.length > best.length)) {
        best = { group, length: token.length };
      }
    }
  }

  if (best) {
    return best.group;
  }

  return rules.groups.find((group) => group.agents.includes("*"));
}

export function isPathAllowed(rules: RobotsRules, userAgent: string, path: string): boolean {
  const group = selectGroup(rules, userAgent);
  if (!group) {
    return true;
  }

  let match: { length: number; allow: boolean } | undefined;
  const consider = (pattern: string, allow: boolean) => {
    if (!pattern || !pathMatches(pattern, path)) {
      return;
    }
    if (!match || pattern.length > match.length || (pattern.length === match.length && allow && !match.allow)) {
      match = { length: pattern.length, allow };
    }
  };

  for (const pattern of group.disallow) {
    consider(pattern, false);
  }
  for (const pattern of group.allow) {
    consider(pattern, true);
  }

  return match ? match.allow : true;
}

function pathMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const source = anchored ? pattern.slice(0, -1) : pattern;
  let expression = "^";
  for (const char of source) {
    expression += char === "*" ? ".*" : escapeRegex(char);
  }
  if (anchored) {
    expression += "$";
  }
  return new RegExp(expression).test(path);
}

function escapeRegex(char: string): string {
  return /[.+?^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
}
