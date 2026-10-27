import { eachDayOfInterval, endOfDay, format, startOfDay, subDays, subMilliseconds } from "date-fns";

export type RangeKey = "today" | "7d" | "30d" | "90d";

export type DateRange = {
  key: RangeKey;
  from: Date;
  to: Date;
  days: number;
  label: string;
  shortLabel: string;
  comparisonLabel: string;
  previousFrom: Date;
  previousTo: Date;
};

export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

export function getDateRange(key: RangeKey, anchor: Date = new Date()): DateRange {
  const days = key === "today" ? 1 : key === "7d" ? 7 : key === "30d" ? 30 : 90;
  const to = endOfDay(anchor);
  const from = startOfDay(subDays(anchor, days - 1));
  const previousTo = subMilliseconds(from, 1);
  const previousFrom = startOfDay(subDays(from, days));

  return {
    key,
    from,
    to,
    days,
    label:
      key === "today"
        ? format(anchor, "d MMM yyyy")
        : key === "7d"
          ? "Last 7 days"
          : key === "30d"
            ? "Last 30 days"
            : "Last 90 days",
    shortLabel: key === "today" ? "Today" : `${days} days`,
    comparisonLabel: key === "today" ? "vs yesterday" : `vs previous ${days} days`,
    previousFrom,
    previousTo,
  };
}

export function dayKeys(from: Date, to: Date) {
  return eachDayOfInterval({ start: from, end: to }).map((day) => format(day, "yyyy-MM-dd"));
}

export function dayKey(value: string | Date) {
  return format(value instanceof Date ? value : new Date(value), "yyyy-MM-dd");
}

export function changePercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function isWithinRange(iso: string, from: Date, to: Date) {
  const time = new Date(iso).getTime();
  return time >= from.getTime() && time <= to.getTime();
}
