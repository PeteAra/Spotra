import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  isWeekend,
  startOfMonth,
  subMonths,
} from "date-fns";

export function monthKey(date: Date): string {
  return format(date, "yyyy-MM");
}

/** True when `day` is before today in the local calendar (today is not past). */
export function isCalendarDayPast(day: Date, now = new Date()): boolean {
  return format(day, "yyyy-MM-dd") < format(now, "yyyy-MM-dd");
}

export function parseMonthKey(key: string): Date {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

export function getMonthGrid(date: Date): Date[] {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const days = eachDayOfInterval({ start, end });

  const leading = getDay(start); // 0 = Sunday
  const trailing = 6 - getDay(end);

  const leadingDays = Array.from({ length: leading }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() - (leading - i));
    return d;
  });

  const trailingDays = Array.from({ length: trailing }, (_, i) => {
    const d = new Date(end);
    d.setDate(d.getDate() + i + 1);
    return d;
  });

  return [...leadingDays, ...days, ...trailingDays];
}

export function sameWeekdayDatesInMonth(source: Date, month: Date): Date[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const weekday = getDay(source);

  return eachDayOfInterval({ start, end }).filter(
    (d) => getDay(d) === weekday && !isSameDay(d, source),
  );
}

export function weekdayDatesInMonth(source: Date, month: Date): Date[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);

  return eachDayOfInterval({ start, end }).filter(
    (d) => !isWeekend(d) && !isSameDay(d, source),
  );
}

/** Map a date from source month to the same weekday occurrence in target month. */
export function mapDateToMonthByWeekdayOccurrence(
  sourceDate: Date,
  targetMonth: Date,
): Date | null {
  const weekday = getDay(sourceDate);
  const occurrence = Math.floor((sourceDate.getDate() - 1) / 7); // 0-based

  const candidates = eachDayOfInterval({
    start: startOfMonth(targetMonth),
    end: endOfMonth(targetMonth),
  }).filter((d) => getDay(d) === weekday);

  return candidates[occurrence] ?? null;
}

export function previousMonth(date: Date): Date {
  return subMonths(startOfMonth(date), 1);
}

export function nextMonth(date: Date): Date {
  return addMonths(startOfMonth(date), 1);
}

export function isInMonth(day: Date, month: Date): boolean {
  return isSameMonth(day, month);
}

export function formatTimeRange(startsAt: string, endsAt: string): string {
  return `${format(new Date(startsAt), "h:mm a")} – ${format(new Date(endsAt), "h:mm a")}`;
}

export function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/** Browser offset minutes (UTC = local + offset). Positive for US timezones. */
export function getClientTimeZoneOffsetMinutes(): number {
  return new Date().getTimezoneOffset();
}

/**
 * Interpret yyyy-MM-dd + HH:mm as wall-clock time in the given timezone offset,
 * and return the corresponding absolute UTC Date.
 * `timeZoneOffsetMinutes` matches `Date#getTimezoneOffset()` (e.g. 300 for EST).
 */
export function wallDateTimeToUtc(
  date: string,
  time: string,
  timeZoneOffsetMinutes: number,
): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hours, minutes, 0, 0) +
      timeZoneOffsetMinutes * 60_000,
  );
}

/** Read wall-clock date/time parts from a stored UTC instant for a given offset. */
export function utcToWallParts(
  iso: string,
  timeZoneOffsetMinutes: number,
): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  date: string;
  time: string;
} {
  const shifted = new Date(
    new Date(iso).getTime() - timeZoneOffsetMinutes * 60_000,
  );
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  const hours = shifted.getUTCHours();
  const minutes = shifted.getUTCMinutes();
  return {
    year,
    month,
    day,
    hours,
    minutes,
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
  };
}

/** Month start / exclusive end in UTC for a calendar month in the user's timezone. */
export function monthBoundsUtc(
  monthKeyStr: string,
  timeZoneOffsetMinutes: number,
): { start: string; endExclusive: string } {
  const [year, month] = monthKeyStr.split("-").map(Number);
  const start = new Date(
    Date.UTC(year, month - 1, 1, 0, 0, 0, 0) + timeZoneOffsetMinutes * 60_000,
  );
  const endExclusive = new Date(
    Date.UTC(year, month, 1, 0, 0, 0, 0) + timeZoneOffsetMinutes * 60_000,
  );
  return { start: start.toISOString(), endExclusive: endExclusive.toISOString() };
}

/** Inclusive day bounds in UTC for a yyyy-MM-dd calendar day in the user's timezone. */
export function dayBoundsUtc(
  date: string,
  timeZoneOffsetMinutes: number,
): { start: string; end: string } {
  const [year, month, day] = date.split("-").map(Number);
  const start = new Date(
    Date.UTC(year, month - 1, day, 0, 0, 0, 0) + timeZoneOffsetMinutes * 60_000,
  );
  const end = new Date(
    Date.UTC(year, month - 1, day, 23, 59, 59, 999) +
      timeZoneOffsetMinutes * 60_000,
  );
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Stable noon-UTC Date for calendar math from a yyyy-MM-dd wall date. */
export function calendarDateAtNoonUtc(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

export type SlotRepeatRule =
  | "none"
  | "daily"
  | "weekly"
  | "weekdays"
  | "weekends";

/**
 * Expand a start date into occurrence dates through the end of that month.
 * Used when creating a repeating time slot (Google Calendar–style presets).
 */
export function expandRepeatDates(
  startDate: string,
  repeat: SlotRepeatRule,
): string[] {
  if (repeat === "none") return [startDate];

  const start = calendarDateAtNoonUtc(startDate);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const startDay = start.getUTCDate();
  const weekday = start.getUTCDay();
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();

  const dates: string[] = [];
  for (let day = startDay; day <= lastDay; day += 1) {
    const current = new Date(Date.UTC(year, month, day, 12));
    const dow = current.getUTCDay();
    const include =
      repeat === "daily" ||
      (repeat === "weekly" && dow === weekday) ||
      (repeat === "weekdays" && dow >= 1 && dow <= 5) ||
      (repeat === "weekends" && (dow === 0 || dow === 6));

    if (include) {
      dates.push(
        `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      );
    }
  }
  return dates;
}
