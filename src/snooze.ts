import type { StateStore } from "./state/types.js";

const SNOOZE_PREFIX = "snooze:";
export const MAX_SNOOZE_MINUTES = 60 * 24 * 30; // 30 days

export function snoozeKey(alertId: string): string {
  return `${SNOOZE_PREFIX}${alertId}`;
}

export interface SnoozeResult {
  alertId: string;
  snoozedUntil: string;
}

/**
 * Suppress delivery of one alert id until `minutes` from now. The expiry
 * timestamp is stored as the state value, so any state backend works.
 */
export async function snoozeAlert(
  state: StateStore,
  alertId: string,
  minutes: number,
  now = Date.now()
): Promise<SnoozeResult> {
  if (!alertId.trim()) {
    throw new Error("Missing alert id");
  }
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error("Snooze minutes must be a positive number");
  }
  if (!state.markAt) {
    throw new Error("The configured state store does not support snoozing");
  }

  const clamped = Math.min(minutes, MAX_SNOOZE_MINUTES);
  const snoozedUntil = new Date(now + clamped * 60_000).toISOString();
  await state.markAt(snoozeKey(alertId), snoozedUntil);
  return { alertId, snoozedUntil };
}

/** Returns the expiry timestamp if the alert is currently snoozed. */
export async function snoozedUntil(
  state: StateStore,
  alertId: string,
  now = Date.now()
): Promise<string | undefined> {
  const until = await state.seenAt?.(snoozeKey(alertId));
  if (!until) {
    return undefined;
  }

  const expiry = Date.parse(until);
  if (Number.isNaN(expiry) || expiry <= now) {
    return undefined;
  }
  return until;
}

export async function isSnoozed(state: StateStore, alertId: string, now = Date.now()): Promise<boolean> {
  return (await snoozedUntil(state, alertId, now)) !== undefined;
}
