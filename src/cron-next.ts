/** Next fire time for three cron forms. Anything else returns null. */
export function nextCronRun(expression: string, from: Date = new Date()): Date | null {
  if (Number.isNaN(from.getTime())) {
    return null;
  }

  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }

  const [minuteField, hourField, dayField, monthField, weekdayField] = parts;
  if (dayField !== "*" || monthField !== "*" || weekdayField !== "*") {
    return null;
  }

  const everyMinutes = /^\*\/(\d{1,2})$/.exec(minuteField);
  if (everyMinutes) {
    if (hourField !== "*") {
      return null;
    }
    const step = Number(everyMinutes[1]);
    if (!Number.isInteger(step) || step < 1 || step > 59) {
      return null;
    }
    return nextStepMinute(from, step);
  }

  if (!/^\d{1,2}$/.test(minuteField)) {
    return null;
  }

  const minute = Number(minuteField);
  if (minute > 59) {
    return null;
  }

  if (hourField === "*") {
    return nextHourlyMinute(from, minute);
  }

  if (!/^\d{1,2}$/.test(hourField)) {
    return null;
  }

  const hour = Number(hourField);
  if (hour > 23) {
    return null;
  }

  return nextDaily(from, hour, minute);
}

function nextStepMinute(from: Date, step: number): Date | null {
  const cursor = new Date(from.getTime());
  cursor.setSeconds(0, 0);
  if (cursor.getTime() < from.getTime()) {
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (cursor.getMinutes() % step === 0) {
      return cursor;
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  return null;
}

function nextHourlyMinute(from: Date, minute: number): Date {
  const cursor = new Date(from.getTime());
  cursor.setSeconds(0, 0);
  cursor.setMinutes(minute, 0, 0);
  if (cursor.getTime() < from.getTime()) {
    cursor.setHours(cursor.getHours() + 1);
  }
  return cursor;
}

function nextDaily(from: Date, hour: number, minute: number): Date {
  const cursor = new Date(from.getTime());
  cursor.setHours(hour, minute, 0, 0);
  if (cursor.getTime() < from.getTime()) {
    cursor.setDate(cursor.getDate() + 1);
  }
  return cursor;
}
