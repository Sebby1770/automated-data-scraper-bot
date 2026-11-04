export interface RunFingerprint {
  id: string;
  title: string;
}

export interface RunDiff {
  added: RunFingerprint[];
  removed: RunFingerprint[];
}

const MAX_SIDE = 40;

export function diffRuns(previous: RunFingerprint[], next: RunFingerprint[]): RunDiff {
  const previousItems = fingerprints(previous);
  const nextItems = fingerprints(next);
  const previousIds = new Set(previousItems.map((item) => item.id));
  const nextIds = new Set(nextItems.map((item) => item.id));

  return {
    added: nextItems.filter((item) => !previousIds.has(item.id)),
    removed: previousItems.filter((item) => !nextIds.has(item.id))
  };
}

export function diffSummary(diff: RunDiff): string {
  const added = sideTitles(diff?.added);
  const removed = sideTitles(diff?.removed);
  if (added.length === 0 && removed.length === 0) {
    return "No alert changes";
  }

  const parts: string[] = [];
  if (added.length > 0) {
    parts.push(`Added ${added.join(", ")}`);
  }
  if (removed.length > 0) {
    parts.push(`Removed ${removed.join(", ")}`);
  }
  return `${parts.join(". ")}.`;
}

function sideTitles(items: RunFingerprint[] | undefined): string[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      const title = typeof item?.title === "string" ? item.title.trim() : "";
      if (title) {
        return title;
      }
      return typeof item?.id === "string" ? item.id : "";
    })
    .filter((value) => value.length > 0);
}

function fingerprints(items: RunFingerprint[]): RunFingerprint[] {
  if (!Array.isArray(items)) {
    return [];
  }

  const seen = new Set<string>();
  const kept: RunFingerprint[] = [];

  for (const item of items) {
    if (kept.length >= MAX_SIDE) {
      break;
    }

    const fingerprint = fingerprintOf(item);
    if (!fingerprint || seen.has(fingerprint.id)) {
      continue;
    }

    seen.add(fingerprint.id);
    kept.push(fingerprint);
  }

  return kept;
}

function fingerprintOf(item: RunFingerprint): RunFingerprint | undefined {
  if (!item || typeof item !== "object") {
    return undefined;
  }

  const id = (item as { id?: unknown }).id;
  if (typeof id !== "string" || id.length === 0) {
    return undefined;
  }

  const title = (item as { title?: unknown }).title;
  return { id, title: typeof title === "string" ? title : "" };
}
