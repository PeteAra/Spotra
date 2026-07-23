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
