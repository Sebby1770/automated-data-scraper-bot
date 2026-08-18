import type { RuleConfig } from "./types.js";
import type { StateStore } from "./state/types.js";

export function resolveCooldownMinutes(
  rule: Pick<RuleConfig, "cooldownMinutes">,
  defaultMinutes?: number
): number {
  const value = rule.cooldownMinutes ?? defaultMinutes ?? 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export async function shouldSkipDuplicate(
  state: StateStore,
  alertId: string,
  cooldownMinutes: number,
  now = Date.now()
): Promise<boolean> {
  if (!(await state.has(alertId))) {
    return false;
  }

  if (cooldownMinutes <= 0) {
    return true;
  }

  const seenAt = await state.seenAt?.(alertId);
  if (!seenAt) {
    return true;
  }

  const elapsed = now - Date.parse(seenAt);
  if (Number.isNaN(elapsed)) {
    return true;
  }

  return elapsed < cooldownMinutes * 60_000;
}
