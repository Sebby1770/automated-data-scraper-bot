import type { QuietHoursSettings } from "./types.js";

export function isQuietHours(settings?: QuietHoursSettings, now = new Date()): boolean {
  if (!settings?.start || !settings?.end) {
    return false;
  }

  const currentMinutes = getMinutesInTimezone(now, settings.timezone ?? "local");
  const startMinutes = parseTimeToMinutes(settings.start);
  const endMinutes = parseTimeToMinutes(settings.end);

  if (startMinutes === undefined || endMinutes === undefined) {
    return false;
  }

  if (startMinutes === endMinutes) {
    return false;
  }

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

export function parseTimeToMinutes(value: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return undefined;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return undefined;
  }

  return hours * 60 + minutes;
}

function getMinutesInTimezone(date: Date, timezone: string): number {
  if (timezone === "local") {
    return date.getHours() * 60 + date.getMinutes();
  }

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false
    }).formatToParts(date);

    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    return hour * 60 + minute;
  } catch {
    return date.getHours() * 60 + date.getMinutes();
  }
}