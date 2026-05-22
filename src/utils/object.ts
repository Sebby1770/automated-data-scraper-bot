export function getPath(record: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current == null || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, record);
}

export function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.replace(/[$£€,%\s,]/g, "");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : undefined;
}
